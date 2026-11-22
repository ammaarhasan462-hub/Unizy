"""Shared helpers for the hand-written top-up packs (tools/packs/<code>.py).
Each module file fills T[topic_pos] with R(...) recall items and E(...) exam items,
then calls emit(CODE, T, expect_total). Output is SQL on stdout: it appends the
questions after the module's current max(position) and marks the pack done."""
import json


def R(q, a):
    return {"tier": "foundation", "kind": "recall", "q": q, "a": a}


def E(q, a, steps, first, two_one, two_two, kind="problem", tier="exam"):
    return {"tier": tier, "kind": kind, "q": q, "a": "\n".join("• " + x for x in a),
            "steps": steps, "guide": {"first": first, "two_one": two_one, "two_two": two_two}}


def lit(v):
    if v is None:
        return "null"
    if isinstance(v, (dict, list)):
        return "$j$" + json.dumps(v, ensure_ascii=False) + "$j$"
    assert "$q$" not in v and "$$" not in v and "$j$" not in v
    return "$q$" + v + "$q$"


def emit(code, T, expect_total):
    n = sum(len(v) for v in T.values())
    for k, v in T.items():
        assert sum(1 for x in v if x["tier"] == "foundation") == 3, (code, k, "recall")
        assert sum(1 for x in v if x["tier"] == "exam") == 1, (code, k, "exam")
    print(f"-- {code}: {n} new questions (pack total {expect_total})")
    print("do $$ declare p int; begin")
    print(f"if (select count(*) from module_questions where code = '{code}') <> {expect_total - n} then raise exception 'unexpected existing count'; end if;")
    print(f"select coalesce(max(position), -1) + 1 into p from module_questions where code = '{code}';")
    print("insert into module_questions (code, position, topic_pos, topic, tier, kind, question, answer, guide, steps)")
    print(f"select '{code}', p + v.i, v.tp, t.title, v.tier, v.kind, v.q, v.a, v.g::jsonb, v.s::jsonb from (values")
    rows, i = [], 0
    for tp in sorted(T):
        for x in T[tp]:
            rows.append(f"({i}, {tp}, '{x['tier']}', '{x['kind']}', {lit(x['q'])}, {lit(x['a'])}, {lit(x.get('guide'))}, {lit(x.get('steps'))})")
            i += 1
    print(",\n".join(rows))
    print(f") v(i, tp, tier, kind, q, a, g, s) join module_topics t on t.code = '{code}' and t.position = v.tp;")
    print(f"insert into module_packs (code, status, questions, started_at, finished_at) values ('{code}', 'done', {expect_total}, now(), now()) "
          f"on conflict (code) do update set status = 'done', questions = {expect_total}, finished_at = now(), error = null;")
    print("end $$;")


# ---- Medicine (exam_format = 'sba'): instant bank + recall cards ----
import random


def V(q, a, accept=(), why=""):
    return {"tier": "foundation", "kind": "vsa", "q": q, "a": a, "accept": list(accept), "why": why}


def S(q, right, wrong, why, hard=False):
    assert len(wrong) == 4
    return {"tier": "first" if hard else "exam", "kind": "sba", "q": q, "right": right, "wrong": list(wrong), "why": why}


def emit_med(code, T, seed=1):
    """T[topic] = list of R() recall cards, V() and S() items. Appends after max(position),
    marks instant_jobs and module_packs done with the final count."""
    rnd = random.Random(seed)
    rows, i = [], 0
    for tp in sorted(T):
        for x in T[tp]:
            if x["kind"] == "recall":
                vals = (x["q"], x["a"], None, None, None)
            elif x["kind"] == "vsa":
                vals = (x["q"], x["a"], None, x["accept"] or None, x["why"])
            else:
                opts = [x["right"]] + x["wrong"]
                rnd.shuffle(opts)
                vals = (x["q"], "ABCDE"[opts.index(x["right"])], opts, None, x["why"])
            q, a, o, acc, why = vals
            rows.append(f"({i}, {tp}, '{x['tier']}', '{x['kind']}', {lit(q)}, {lit(a)}, {lit(o)}, {lit(acc)}, {lit(why)})")
            i += 1
    print(f"-- {code}: {i} new items")
    print("do $$ declare p int; n int; begin")
    print(f"select coalesce(max(position), -1) + 1 into p from module_questions where code = '{code}';")
    print("insert into module_questions (code, position, topic_pos, topic, tier, kind, question, answer, options, accept, explain)")
    print(f"select '{code}', p + v.i, v.tp, t.title, v.tier, v.kind, v.q, v.a, v.o::jsonb, v.acc::jsonb, v.why from (values")
    print(",\n".join(rows))
    print(f") v(i, tp, tier, kind, q, a, o, acc, why) join module_topics t on t.code = '{code}' and t.position = v.tp;")
    print(f"select count(*) into n from module_questions where code = '{code}';")
    print(f"insert into instant_jobs (code, status, finished_at) values ('{code}', 'done', now()) on conflict (code) do update set status = 'done', finished_at = now();")
    print(f"insert into module_packs (code, status, questions, started_at, finished_at) values ('{code}', 'done', n, now(), now()) on conflict (code) do update set status = 'done', questions = n, finished_at = now(), error = null;")
    print("end $$;")
