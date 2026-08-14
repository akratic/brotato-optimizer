import csv
import math
import os
import re

WEAPON_COUNT = 6  # "amount of weapons owned" - fixed constant, matches the sheet's test scenario

DAMAGE_STAT_NAMES = {
    "ranged": "DPS_Ranged_Damage",
    "melee": "DPS_Melee_Damage",
    "elemental": "DPS_Elemental_Damage",
}
DAMAGE_STAT_KEYS = {v: k for k, v in DAMAGE_STAT_NAMES.items()}

# Superset of DAMAGE_STAT_NAMES used only to detect/compare *hybrid* weapons'
# competing scaling stats (see classify_weapon) - Engineering shows up as a
# third competing stat on Plank, alongside melee/elemental.
HYBRID_STAT_NAMES = {**DAMAGE_STAT_NAMES, "engineering": "DPS_Engineering"}
HYBRID_STAT_KEYS = {v: k for k, v in HYBRID_STAT_NAMES.items()}

# Stat gained per level-up point, per the game's official level-up table.
# Everything past "elemental" isn't a damage stat, but some weapons' damage
# scales off it (see below) via the generic "Special Stat" calculator slot.
DAMAGE_STAT_PER_LEVEL = {
    "ranged": 1.0, "melee": 2.0, "elemental": 1.0,
    "armor": 1.0, "engineering": 1.5, "speed": 3.0,
    "dodge": 3.0, "luck": 7.5, "life_steal": 1.5, "harvesting": 4.0,
}
DMG_PCT_PER_LEVEL = 0.04
ATK_SPD_PER_LEVEL = 0.05
CRIT_CHANCE_PER_LEVEL = 0.03

# Some weapons scale off a stat that isn't melee/ranged/elemental damage, fed
# through the generic "2/3 Scaling Stat" = DPS_Special_Stat slot. The CSV's
# own "Special Stat Name" column names which real stat that is for most of
# them (Armor, Dodge, Luck, Life Steal, Harvesting). Anything not listed here
# (the generic "Special Scaling" placeholder, "Level", "Additional Sticks",
# "Empty Weapon Slots", ...) is left inert - either it isn't a real level-up
# stat, or modeling it needs more than a simple point split (e.g. "Additional
# Sticks" scales with items held, not a level-up point).
SPECIAL_STAT_NAME_KEYS = {
    "Armor": "armor",
    "Dodge": "dodge",
    "Luck": "luck",
    "Life Steal": "life_steal",
    "Harvesting": "harvesting",
}

# A few weapons leave "Special Stat Name" at the generic placeholder despite
# genuinely scaling with a real stat - Jousting Lance's damage actually scales
# with Speed (verified against the Brotato wiki: its "2 Flat Scaling" of
# 0.3/0.35/0.4/0.5 across tiers 1-4 matches the wiki's stated 30/35/40/50%
# Speed scaling exactly). Keyed by base weapon name (tier number stripped);
# checked before SPECIAL_STAT_NAME_KEYS. Add more here as they're found rather
# than trusting "Special Stat Name" blindly.
SPECIAL_STAT_NAME_OVERRIDES = {
    "Jousting Lance": "speed",
}
SPECIAL_STAT_NAME = "DPS_Special_Stat"


def _resolve_special_stat(row, base_name):
    """The real meaning of DPS_Special_Stat for this weapon, or None if it
    isn't one we model (see SPECIAL_STAT_NAME_KEYS/_OVERRIDES above)."""
    if base_name in SPECIAL_STAT_NAME_OVERRIDES:
        return SPECIAL_STAT_NAME_OVERRIDES[base_name]
    return SPECIAL_STAT_NAME_KEYS.get(row["Special Stat Name"])

# Icon folders that were renamed relative to the CSV's (older) weapon names.
# Keyed by the CSV base name normalized to lowercase-alphanumeric-only; see
# resolve_icon().
ICON_NAME_ALIASES = {
    "cacticlub": "cactus_mace",
    "thiefdagger": "dagger",
    "quarterstaff": "fighting_stick",
    "flamingbrassknuckles": "flaming_knuckles",
    "hikingpole": "hiking_stick",
}


def load_weapon(name, csv_path="weapons.csv"):
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Weapon"] == name:
                return row
    raise KeyError(f"Weapon not found: {name}")


def classify_weapon(row):
    """
    Determine whether compute_dps/best_split can model this weapon, and which
    damage stat (ranged/melee/elemental) its level-ups should feed, by reading
    the CSV directly instead of hardcoding it per weapon.

    Returns (supported: bool, damage_stat: str | None, reason: str | None).
    """
    weapon_type = row["Weapon Type"]
    if weapon_type not in ("Ranged", "Melee"):
        return False, None, "not a weapon row"

    base_name = re.sub(r"\s+\d+$", "", row["Weapon"].strip())
    prim_stat = row["Prim Stat"]
    if prim_stat not in DAMAGE_STAT_KEYS:
        special_key = _resolve_special_stat(row, base_name)
        if special_key and SPECIAL_STAT_NAME in (row["2 Scaling Stat"], row["3 Scaling Stat"]):
            return True, special_key, None
        return False, None, f"unrecognized primary scaling stat: {prim_stat!r}"

    # Collect every damage-type stat this weapon scales with, alongside the
    # (flat-scaling, multiplier) pair that applies to it in compute_dps's
    # bonus1/bonus2/bonus3.
    candidates = [(DAMAGE_STAT_KEYS[prim_stat], _num(row, "1 Flat Scaling"), _num(row, "Prim Stat Multiplier"))]
    for scale_col, stat_col, mult_col in (
        ("2 Flat Scaling", "2 Scaling Stat", "2 Scaling Stat Multiplier"),
        ("3 Flat Scaling", "3 Scaling Stat", "3 Scaling Stat Multiplier"),
    ):
        stat_name = row[stat_col]
        if stat_name in HYBRID_STAT_KEYS and stat_name != prim_stat:
            candidates.append((HYBRID_STAT_KEYS[stat_name], _num(row, scale_col), _num(row, mult_col)))
        elif stat_name == SPECIAL_STAT_NAME:
            special_key = _resolve_special_stat(row, base_name)
            if special_key:
                candidates.append((special_key, _num(row, scale_col), _num(row, mult_col)))

    if len(candidates) == 1:
        return True, candidates[0][0], None

    # Hybrid: multiple stats compete for the same level-up points. Each
    # bonus_i = floor(scale_i * DAMAGE_STAT_PER_LEVEL[stat_i] * levels_i * mult_i)
    # is summed independently, with no interaction between stats. For a fixed
    # shared point budget D, investing it entirely into whichever stat has the
    # highest effective coefficient (scale_i * DAMAGE_STAT_PER_LEVEL[stat_i] *
    # mult_i) is *always* at least as good as any split, regardless of how the
    # coefficients compare to each other: writing c1 = max coefficient,
    # floor(c1*D) = floor(c1*x + c1*(D-x)) >= floor(c1*x) + floor(c1*(D-x))
    # (floor is superadditive) >= floor(c1*x) + floor(c2*(D-x)) (c1 >= c2, floor
    # is monotonic) - i.e. concentrating in the max never loses to any split.
    # Verified against a true brute-force sweep (D=0..100) of every hybrid
    # weapon in the data, including cases where coefficients differ across
    # stats (e.g. Screwdriver 3/4, where Engineering actually wins) - zero
    # mismatches.
    best_stat = max(candidates, key=lambda c: c[1] * DAMAGE_STAT_PER_LEVEL[c[0]] * c[2])[0]
    return True, best_stat, None


def _normalize_name(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _icon_search_dirs(icons_root, type_dir):
    """
    Base-game icons live under icons/weapons/<melee|ranged>/; DLC icons live
    under a per-pack folder, icons/dlcs/<dlc_name>/weapons/<melee|ranged>/.
    Search the base game first, then every DLC pack found.
    """
    dirs = [os.path.join(icons_root, "weapons", type_dir)]
    dlcs_root = os.path.join(icons_root, "dlcs")
    if os.path.isdir(dlcs_root):
        for dlc_name in sorted(os.listdir(dlcs_root)):
            candidate = os.path.join(dlcs_root, dlc_name, "weapons", type_dir)
            if os.path.isdir(candidate):
                dirs.append(candidate)
    return dirs


def resolve_icon(weapon_name, weapon_type, icons_root="icons"):
    """
    Find the icon PNG for a weapon (any tier) by matching its base name
    (tier number stripped) against the <slug>/ folders under icons/weapons/
    and icons/dlcs/*/weapons/, normalizing both sides to
    lowercase-alphanumeric-only. Falls back to a small hardcoded alias table
    for the handful of weapons the icon set renamed. Returns a full path, or
    None if unmatched.
    """
    type_dir = "melee" if weapon_type == "Melee" else "ranged"
    base_name = re.sub(r"\s+\d+$", "", weapon_name.strip())
    key = _normalize_name(base_name)
    target_folder = ICON_NAME_ALIASES.get(key)

    for search_dir in _icon_search_dirs(icons_root, type_dir):
        if not os.path.isdir(search_dir):
            continue
        for entry in os.listdir(search_dir):
            if entry == target_folder or (target_folder is None and _normalize_name(entry) == key):
                icon_path = os.path.join(search_dir, entry, f"{entry}_icon.png")
                if os.path.isfile(icon_path):
                    return icon_path

    return None


def excel_round(x):
    """Excel ROUND(x, 0): round half away from zero (vs. Python's round-half-to-even)."""
    return math.floor(x + 0.5) if x >= 0 else math.ceil(x - 0.5)


def _num(row, key):
    v = row[key]
    return float(v) if v not in ("", None) else 0.0


def compute_dps(weapon_row, damage_stat, damage_levels, dmg_pct_levels, atk_spd_levels, crit_levels):
    """
    Replicates 'DPS Calculator'!M17 for a Ranged or Melee weapon with no piercing/
    bounce/spawn (e.g. SMG 2, Spear 3). Weapons with those extra mechanics (e.g.
    Icicle 2's innate pierce) aren't implemented yet. Reload-every-x-shots
    weapons (e.g. Revolver, Chain Gun) are implemented via the divisor at the
    end of this function.

    damage_stat: any key in DAMAGE_STAT_PER_LEVEL - which stat DAMAGE_LEVELS
    increments (see classify_weapon for how a weapon's damage_stat is chosen,
    including hybrid weapons and the Armor/Speed special-stat overrides).
    Each level-up: ranged/elemental damage +1, melee damage +2, armor +1,
    engineering +1.5, speed +3, dmg% +4%, attack speed +5%, crit chance +3%.
    """
    row = weapon_row
    if row["Weapon Type"] not in ("Ranged", "Melee"):
        raise NotImplementedError(f"Unsupported weapon type: {row['Weapon Type']!r}")
    # Note: Bounces/Pierce/Spawned Projectiles don't feed into M17 (base hit DPS) at
    # all in the sheet - they only add to N17/P17, which we're not computing.

    stat_values = {
        "DPS_Melee_Damage": 0.0,
        "DPS_Ranged_Damage": 0.0,
        "DPS_Elemental_Damage": 0.0,
        "DPS_Engineering": 0.0,
        "DPS_Max_HP": 0.0,
        "DPS_Special_Stat": 0.0,
        "DPS_Curse": 0.0,
        "DPS_Range_Stat": 0.0,
        "DPS_Attack_Speed": 0.0,
    }
    if damage_stat in SPECIAL_STAT_NAME_KEYS.values() or damage_stat in SPECIAL_STAT_NAME_OVERRIDES.values():
        damage_stat_name = SPECIAL_STAT_NAME
    elif damage_stat in DAMAGE_STAT_NAMES:
        damage_stat_name = DAMAGE_STAT_NAMES[damage_stat]
    else:
        damage_stat_name = HYBRID_STAT_NAMES[damage_stat]
    stat_values[damage_stat_name] = DAMAGE_STAT_PER_LEVEL[damage_stat] * float(damage_levels)
    dmg_percent = DMG_PCT_PER_LEVEL * dmg_pct_levels
    attack_speed = ATK_SPD_PER_LEVEL * atk_spd_levels
    crit_chance_stat = CRIT_CHANCE_PER_LEVEL * crit_levels
    stat_values["DPS_Attack_Speed"] = attack_speed

    # --- Damage Per Hit (M8) ---
    base_dmg = _num(row, "Base Dmg")
    scale1 = _num(row, "1 Flat Scaling")
    scale2 = _num(row, "2 Flat Scaling")
    scale3 = _num(row, "3 Flat Scaling")

    def bonus(stat_col, mult_col, scale):
        stat_name = row[stat_col]
        if not stat_name:
            return 0
        mult = _num(row, mult_col)
        return math.floor(scale * stat_values[stat_name] * mult)

    bonus1 = bonus("Prim Stat", "Prim Stat Multiplier", scale1)
    bonus2 = bonus("2 Scaling Stat", "2 Scaling Stat Multiplier", scale2)
    bonus3 = bonus("3 Scaling Stat", "3 Scaling Stat Multiplier", scale3)

    inner = max(base_dmg + bonus1 + bonus2 + bonus3, 1)
    dmg_per_hit = excel_round(max(inner * (1 + dmg_percent), 1))

    # --- Crit (N8, O8, P8) ---
    crit_multiplier = _num(row, "Crit Multiplier")
    crit_hit_dmg = excel_round(dmg_per_hit * crit_multiplier)
    base_crit_chance = _num(row, "Base Crit Chance")
    crit_chance_final = min(max(base_crit_chance + crit_chance_stat, 0), 1)
    crit_dps_inc = 0 if dmg_per_hit == 0 else crit_chance_final * (crit_hit_dmg / dmg_per_hit - 1)

    # --- Cooldown / Attacks per sec (M6, O6) ---
    base_wpn_spd = _num(row, "Cooldown Stat")
    base_recoil = _num(row, "Recoil Duration")

    if attack_speed >= 0:
        inc_wpn_spd = math.floor(max(2, base_wpn_spd / (1 + attack_speed)))
        inc_recoil = base_recoil / (1 + attack_speed)
    else:
        inc_wpn_spd = math.floor(max(2, base_wpn_spd * (1 + abs(attack_speed))))
        inc_recoil = base_recoil

    # weapon randomization smoothing term (depends on weapon count and inc_wpn_spd)
    s34 = WEAPON_COUNT
    t34 = min(0.2 * s34, 1.2)
    u34 = inc_wpn_spd
    s36 = min(t34 * u34, 5 * s34)
    t36 = max(1, u34 - s36)
    u36 = s36 + u34
    v36 = (t36 + u36) / 2
    w34 = 0 if t34 == 0 else 0.5
    weapon_randomization = v36 + w34 - u34

    if row["Weapon Type"] == "Ranged":
        true_cooldown = (inc_wpn_spd + 1) / 60 + (math.floor(inc_recoil * 60 + 1) / 60) * 2 \
            + weapon_randomization / 60
    else:  # Melee
        base_range = _num(row, "Base Range")
        range_stat = 0.0  # not one of our level-up buckets; held fixed
        range_factor = max(0, max(25, base_range + range_stat / 2)
                            / min(max(70, 70 * (1 + attack_speed / 3)), 120))
        atk_dur = max(0.01, 0.2 - attack_speed / 10) + range_factor * 0.15
        back_dur = 0.2 / (1 + max(0, attack_speed) * 3)

        attack_type = row["Attack Type"]
        swing_bonus = 1 / 60 if attack_type == "Swing" else 0
        swing_thrust_bonus = 1 / 120 if attack_type == "Swing/Thrust" else 0

        true_cooldown = math.floor(
            (inc_wpn_spd + 1) + math.floor(inc_recoil * 60 + 1)
            + math.floor(atk_dur / 2 * 60 + 1) + math.floor(back_dur * 60 + 1) + 1
        ) / 60 + swing_bonus + swing_thrust_bonus + weapon_randomization / 60

    attacks_per_sec = 1 / true_cooldown

    projectiles = _num(row, "Amount of Projectiles")

    dps = dmg_per_hit * (1 + crit_dps_inc) * attacks_per_sec * projectiles

    # --- Reload every X shots (V8/M17's IF(DPS_ReloadX_Shots>0, ...) divisor) ---
    reload_x_shots = _num(row, "Reload every x Shots")
    if reload_x_shots > 0:
        reload_multiplier = _num(row, "Reload Multiplier")
        reload_cooldown = (inc_wpn_spd * reload_multiplier + 1) / 60 \
            + math.floor(inc_recoil * 60 + 1) / 60 * 2
        reload_factor = 1 + ((reload_cooldown / true_cooldown - 1) / reload_x_shots)
        dps = dps / reload_factor

    return dps


def all_splits(n):
    rows = []
    for a in range(n + 1):
        for b in range(n - a + 1):
            for c in range(n - a - b + 1):
                d = n - a - b - c
                rows.append((a, b, c, d))
    return rows


def best_split(weapon_row, damage_stat, n):
    best = None
    for a, b, c, d in all_splits(n):
        # a=damage_stat levels, b=dmg%, c=attack speed, d=crit
        value = compute_dps(weapon_row, damage_stat, a, b, c, d)
        if best is None or value > best[0]:
            best = (value, a, b, c, d)
    return best


if __name__ == "__main__":
    weapon_name = "Icicle 2"
    damage_stat = "elemental"
    weapon_row = load_weapon(weapon_name)

    N = 4
    print(f"All unique level-up splits for {weapon_name} ({damage_stat} damage) at N={N}:")
    print(f"{damage_stat}_dmg,dmg%,atk_spd,crit,total_{damage_stat}_dmg,total_dmg_pct,total_atk_spd,total_crit,DPS")
    results = []
    for a, b, c, d in all_splits(N):
        value = compute_dps(weapon_row, damage_stat, a, b, c, d)
        results.append((a, b, c, d, value))
    for a, b, c, d, value in sorted(results, key=lambda r: -r[4]):
        print(f"{a},{b},{c},{d},{DAMAGE_STAT_PER_LEVEL[damage_stat]*a},{100*DMG_PCT_PER_LEVEL*b},"
              f"{100*ATK_SPD_PER_LEVEL*c},{100*CRIT_CHANCE_PER_LEVEL*d},{value:.4f}")

    value, a, b, c, d = best_split(weapon_row, damage_stat, N)
    print(f"\nBest for N={N}: {damage_stat}_dmg={a}, dmg%={b}, atk_spd={c}, crit={d}  ->  DPS={value:.4f}")

    print(f"\nN,{damage_stat}_dmg_level_up,dmg_pct_level_up,atk_spd_level_up,crit_level_up,"
          f"total_{damage_stat}_dmg,total_dmg_pct,total_atk_spd,total_crit,DPS")
    for n in range(1, 101):
        value, a, b, c, d = best_split(weapon_row, damage_stat, n)
        print(f"{n},{a},{b},{c},{d},{DAMAGE_STAT_PER_LEVEL[damage_stat]*a},{100*DMG_PCT_PER_LEVEL*b},"
              f"{100*ATK_SPD_PER_LEVEL*c},{100*CRIT_CHANCE_PER_LEVEL*d},{value:.4f}")
