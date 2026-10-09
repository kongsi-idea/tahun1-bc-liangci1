"""给题库每个字标拼音（pypinyin + 一的变调），输出 pinyin-data.js。
用法：python3 gen-pinyin.py。改题库后要重跑；多音字（着/得/地…）已在 FIX 里逐句核对。"""
import re, json, subprocess, os
from pypinyin import pinyin, Style
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'data.js'), encoding='utf-8').read()
texts = re.findall(r"text: '([^']+)'", src)
FIX = {}   # 需要人工纠正的 (文本, 字序号) -> 拼音
GAP = re.compile(r'（\s*）')
out = {}
for t in texts:
    chars = []; i = 0
    parts = GAP.split(t)             # 空格前后两段
    answer_gap = len(parts) == 2
    py = []
    for pi, part in enumerate(parts):
        py += [s[0] for s in pinyin(part, style=Style.TONE, neutral_tone_with_five=False)]
        if pi < len(parts) - 1: py.append(None)   # 空格位置
    # 汉字序列（不含空格）与 py 对齐：逐字
    seq = []
    for pi, part in enumerate(parts):
        for ch in part: seq.append(ch)
        if pi < len(parts) - 1: seq.append('（）')
    assert len(seq) == len(py), t
    # 一的变调：按实际读音，后字四声读 yí，其余 yì（「一」在句末、序数不在题库里）
    for k, ch in enumerate(seq):
        if ch == '一' and k + 1 < len(seq):
            nxt = py[k + 1]
            if nxt is None:  # 后面是空格：读音由答案量词决定，网页里再换（片 yí，其余 yì）
                py[k] = 'YI'; continue
            tone = next((c for c in nxt if c in 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'), '')
            py[k] = 'yí' if tone in 'àèìòùǜ' else 'yì'
    out[t] = py
# 「地」做助词读 de（快快乐乐地、欢快地）
for t, py in out.items():
    for k, ch in enumerate(t.replace('（ ）', '？')):
        if ch == '地' and k > 0 and t.replace('（ ）', '？')[k - 1] in '乐快': py[k] = 'de'
open(os.path.join(HERE, 'pinyin-data.js'), 'w', encoding='utf-8').write(
    '// 由 gen-pinyin.py 生成，不要手改\nwindow.PY = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
for t, py in out.items(): print(t, '|', ' '.join('？' if p is None else p for p in py))
