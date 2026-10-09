"""量词南瓜丰收季 端到端测试：用真鼠标拖放/点选，两关从头走到尾。
用法：先 `python3 -m http.server 8941`，再 `python3 test-e2e.py`。TARGET 可改线上网址。VW/VH 可改视口。
截图放 ~/Documents/my-agent/playwright-to-delete/。"""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('TARGET', 'http://localhost:8941/index.html')
W, H = int(os.environ.get('VW', 1366)), int(os.environ.get('VH', 768))
OUT = os.path.expanduser('~/Documents/my-agent/playwright-to-delete'); os.makedirs(OUT, exist_ok=True)
TAG = f'liangci1-{W}x{H}'
fails = 0
def check(name, ok, extra=''):
    global fails
    print(('  ✅ ' if ok else '  ❌ ') + name + (f' — {extra}' if extra else ''))
    if not ok: fails += 1

def center(loc):
    b = loc.bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

def drag_to(page, word, target):
    sx, sy = center(page.locator(f'.qcard[data-w="{word}"]'))
    tx, ty = center(target)
    page.mouse.move(sx, sy); page.mouse.down(); page.mouse.move(sx + 20, sy - 20, steps=4)
    page.mouse.move(tx, ty, steps=10); page.mouse.up()

def tap_pair(page, word, target):
    page.locator(f'.qcard[data-w="{word}"]').click(); target.click(force=True)

with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': W, 'height': H}, has_touch=False)
    page = ctx.new_page(); errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(URL); page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/{TAG}-home.png')
    check('首页有两个关卡按钮', page.locator('[data-start]').count() == 2)

    # 宝典
    page.click('#openGuide'); check('宝典 6 张卡', page.locator('.g-card').count() == 6)
    page.screenshot(path=f'{OUT}/{TAG}-guide.png'); page.click('#closeGuide2')

    # 关卡一
    page.click('[data-start="1"]'); page.wait_for_timeout(300)
    check('关卡一首屏 6 粒南瓜', page.locator('.pumpkin').count() == 6)
    page.screenshot(path=f'{OUT}/{TAG}-lv1.png')
    api = lambda js: page.evaluate(js)
    # 故意先答错一次（选个不对的）：第 1 粒
    first = api("() => { const s = __liangci.S; return s.round[0].answer }")
    wrong = '双' if first != '双' else '朵'
    tap_pair(page, wrong, page.locator('.pumpkin').nth(0)); page.wait_for_timeout(200)
    check('答错出现观察提示', '再想想' in page.locator('#feedback').inner_text())
    page.screenshot(path=f'{OUT}/{TAG}-lv1-wrong.png')
    tap_pair(page, wrong, page.locator('.pumpkin').nth(0)); page.wait_for_timeout(200)
    check('第二次答错出现完整提示', '再想想' not in page.locator('#feedback').inner_text())

    # 一路答对到本关结束（含回炉）：每次读当前 round，对第一个未完成的南瓜答对
    rounds, used_drag = 0, 0
    for _ in range(80):
        if page.locator('#result.is-active').count(): break
        st = api("() => { const s = __liangci.S; const i = s.round.findIndex(x => !x.done); return i < 0 ? null : { i, a: s.round[i].answer, busy: s.busy } }")
        if not st or st['busy']: page.wait_for_timeout(250); continue
        tgt = page.locator('.pumpkin').nth(st['i'])
        if used_drag % 2 == 0: drag_to(page, st['a'], tgt)
        else: tap_pair(page, st['a'], tgt)
        used_drag += 1; page.wait_for_timeout(1500 if page.locator('.lv1').count() else 2000)
    page.wait_for_timeout(600)
    check('关卡一结算出现', page.locator('#result.is-active').count() == 1)
    check('结算：星星 > 0', int(page.locator('#resStars').inner_text()) > 0, page.locator('#resMsg').inner_text())
    check('结算：量词条形图', page.locator('.bar-row').count() == 6)
    page.screenshot(path=f'{OUT}/{TAG}-result1.png')

    # 关卡二
    page.click('#resNext'); page.wait_for_timeout(500)
    check('关卡二显示一个句子', page.locator('.sentence').count() == 1)
    page.screenshot(path=f'{OUT}/{TAG}-lv2.png')
    for _ in range(60):
        if page.locator('#result.is-active').count(): break
        st = api("() => { const s = __liangci.S; const it = s.round[0]; return it && !it.done ? { a: it.answer, busy: s.busy } : null }")
        if not st or st['busy']: page.wait_for_timeout(250); continue
        drag_to(page, st['a'], page.locator('.s-text')); page.wait_for_timeout(2300)
    page.wait_for_timeout(600)
    check('关卡二结算出现', page.locator('#result.is-active').count() == 1)
    page.screenshot(path=f'{OUT}/{TAG}-result2.png')
    check('控制台无红字', not errs, '; '.join(errs[:3]))
    br.close()
print('FAILS:', fails); raise SystemExit(1 if fails else 0)
