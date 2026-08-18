def armor_factor(armor):
    return 1 + (2 / 30) * armor


def dodge_factor(dodge, cap=60):
    return 1 / (1 - min(dodge, cap) / 100) if dodge > 0 else 1


def ehp(hp_levels, armor_levels, dodge_levels):
    hp = 10 + 3 * hp_levels
    armor = 1 * armor_levels
    dodge = 3 * dodge_levels

    return hp * armor_factor(armor) * dodge_factor(dodge)


def best_split(n):
    best = None
    for a in range(n + 1):
        for b in range(n - a + 1):
            c = n - a - b
            value = ehp(a, b, c)
            if best is None or value > best[0]:
                best = (value, a, b, c)
    return best


def all_splits(n):
    rows = []
    for a in range(n + 1):
        for b in range(n - a + 1):
            c = n - a - b
            rows.append((a, b, c, ehp(a, b, c)))
    return rows


def dodge_armor_coefficient_curve(min_dodge=-10, max_dodge=100, cap=60):
    """
    Relative value of +3% dodge vs +1 armor, as starting dodge varies.
    EHP is a pure product (hp * armor_factor * dodge_factor), so the *relative*
    (%) EHP gain from bumping either factor is independent of the other two -
    it only depends on the factor's own current value. armor_factor is linear,
    so its %-gain from +1 armor is the same 2/30 regardless of starting armor.

    `cap` is the dodge cap to use (normally 60; some items like Ghost Outfit/Ghost
    raise it).
    """
    armor_pct_gain = armor_factor(1) / armor_factor(0) - 1
    curve = []
    for dodge in range(min_dodge, max_dodge + 1):
        dodge_pct_gain = dodge_factor(dodge + 3, cap) / dodge_factor(dodge, cap) - 1
        m = dodge_pct_gain / armor_pct_gain
        curve.append({"dodge": dodge, "dodge_pct_gain": dodge_pct_gain, "armor_pct_gain": armor_pct_gain, "m": m})
    return curve


if __name__ == "__main__":
    N = 4
    print(f"All unique (hp, armor, dodge) splits for N={N}:")
    for a, b, c, value in sorted(all_splits(N), key=lambda r: -r[3]):
        print(f"  hp={a} armor={b} dodge={c}  ->  EHP={value:.4f}")

    value, a, b, c = best_split(N)
    print(f"\nBest for N={N}: hp_level_up={a}, armor_level_up={b}, dodge_level_up={c}  ->  EHP={value:.4f}")

    print("\nN,hp_level_up,armor_level_up,dodge_level_up,EHP")
    for n in range(1, 101):
        value, a, b, c = best_split(n)
        print(f"{n},{a},{b},{c},{value:.4f}")

    print("\nstarting_dodge,dodge_pct_gain,armor_pct_gain,M")
    for row in dodge_armor_coefficient_curve():
        print(f"{row['dodge']},{row['dodge_pct_gain']:.6f},{row['armor_pct_gain']:.6f},{row['m']:.4f}")
