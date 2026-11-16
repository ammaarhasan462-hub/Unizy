# Builds site/data/samples.json: a practice answer for each full-pack module's 5-minute starter question
# (the question mark.js opens for /modules/<CODE>?q=start). "q" = first 8 chars of the question id, so a sample
# is only shown on the exact question it was written for.
import json, importlib.util, os
IDS = dict(x.split(':') for x in """AC102:b9bd7c65 ANAT0001:e98e0f97 BIO116:89e0c1ac BIO161:3f71c19a BIOC0001:bec987ae BIOL0003:9d243b8b BMD113:5ff84b6d
BMD121:d595f24c BMD164:aa2e384a BUS280:c077f25d BUS281:862904da BUS4002U:2dd05990 CHEM0008:7514cee2 CHEM0011:769ab9ce CHEM40006:8365c6cb
COMP0002:76ca8664 COMP0003:909ba67f COMP0004:9a60b31b COMP0005:cc5773b0 COMP40008:0c0a7c14 EC1A3:b376ab8d EC1B3:8d141e04 ECN106:d00e5336
ECN111:f4ff734b ECN113:375f5fce ECN115:59711bdc ECN214:0275bbb1 ECON0002:3072a41a ECON0004:da98527a ECON0006:a4c3b015 ECON0007:5d2d309f
ECON0010:03534e27 ECS401U:b2a0bf9b ECS407U:ab3afe4a ELEC40002:c5515187 EMS460U:f743d78b GV100:a989e828 GV101:6737a732 HIST0003:b02a6045
HY116:a277960e IR100:eaac940a LAW4001:4f5a286b LAW4006:6b57581e LAW4009:e77f5ce1 LAW4104:ff21b78c LAW4105:f6552339 LAWS0001:11eb95ff
LAWS0002:40f29dd9 LAWS0007:30be077f LIFE40001:0e7680a8 LIFE40006:4eacf64f MA100:f4c4cf6b MATH0003:1f5fa085 MATH0004:3e0ebccf MATH0005:4364e86b
MATH0006:7bb7f7e3 MATH40002:216f0f70 MATH40004:f4baf988 MECH40003:309a84ad MED41B3:2a3d0e5a MED52B3:c9d1d3b1 MSIN0002:c319213c MSIN0004:2c9d7bbe
MSIN0012:0193a2ff MTH5123:830167ec MTH5129:da4bb314 NEUR0004:a92a7c7c PALS0007:bb259d39 PALS0008:d06723a1 PH103:d0f6f993 PHAS0002:6ce47160
PHAS0010:70243f2d PHIL0003:09d986e0 PHIL0006:b6fc8673 PHOL0001:e69f01dd PHYS40002:f7b6874d POL105:3ea69f7c POL108:1c4ccb6f POL110:41ead94f
POL263:c90e6b19 POLS0002:27d3daa8 POLS0006:f80a4a51 POLS0061:7d636d8e PSY121:65d4fca4 PSY211:3b1b9edb PSY215:77d3e6b8 ST102:ac40cbfb
STAT0002:2bfeb812 STAT0003:20aaeae1""".split())
S = {}
here = os.path.dirname(os.path.abspath(__file__))
for f in ('samples_a', 'samples_b', 'samples_c'):
    spec = importlib.util.spec_from_file_location(f, os.path.join(here, f + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    S.update(m.S)
missing = sorted(set(IDS) - set(S)); extra = sorted(set(S) - set(IDS))
assert not missing and not extra, (missing, extra)
out = {c: {'q': IDS[c], 'a': S[c].strip()} for c in sorted(IDS)}
short = {c: len(v['a'].split()) for c, v in out.items() if len(v['a'].split()) < 60}
assert not short, short
json.dump(out, open(os.path.join(here, '..', 'site', 'data', 'samples.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
w = [len(v['a'].split()) for v in out.values()]
print(len(out), 'samples; words min/avg/max', min(w), sum(w) // len(w), max(w))
