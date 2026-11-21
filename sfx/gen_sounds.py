#!/usr/bin/env python3
"""人狼将棋 ガチャ演出用 効果音5種を numpy で合成する（v2）。
WAV を書き出し、最後に音量（ピーク -1dB / RMS）をそろえる。
mp3 変換は ffmpeg で別途行う。

v2 の変更点: ファンファーレ2種を「ピアノっぽい単音」から
弦楽器（バイオリン風アンサンブル）中心の編成に作り直した。
- 弦: デチューンしたノコギリ波2本＋ビブラート＋ローパス＋遅いアタック
- 金管: ノコギリ波＋速いアタック（LRのスタッブ用）
- ティンパニ: ピッチの下がる低音バースト（LR用）
レバー／カプセル2種は v1 と同一（乱数シード固定で同じ音になる）。
"""
import numpy as np
import wave, os

SR = 44100
OUT = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(42)


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def lowpass(x, alpha):
    """簡易1次ローパス（alpha 小さいほど強くカット）"""
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def highpass(x, alpha):
    return x - lowpass(x, alpha)


def add(buf, sig, start):
    """buf の start 秒位置に sig を加算"""
    i = int(start * SR)
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i]
    return buf


def env_ad(n, attack=0.003, decay_tau=0.03):
    t = np.arange(n) / SR
    e = np.exp(-t / decay_tau)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def tone(freq, dur, vol=1.0, harmonics=(1.0, 0.45, 0.2), decay_tau=None, slide_to=None):
    """倍音つきトーン。slide_to 指定でピッチが線形に変化"""
    t = t_axis(dur)
    if slide_to is None:
        phase = 2 * np.pi * freq * t
    else:
        f = freq + (slide_to - freq) * (t / dur)
        phase = 2 * np.pi * np.cumsum(f) / SR
    y = np.zeros_like(t)
    for k, h in enumerate(harmonics, start=1):
        y += h * np.sin(phase * k)
    if decay_tau is None:
        decay_tau = dur / 2.5
    y *= env_ad(len(t), decay_tau=decay_tau)
    return y * vol


def _saw(phase):
    return 2.0 * (phase - np.floor(phase + 0.5))


def string_note(freq, dur, vol=1.0, attack=0.09):
    """バイオリン風の弦音: デチューンしたノコギリ波2本＋ビブラート
    （立ち上がり後に効く）＋ローパスで温かく。弓ノイズを微量混ぜる。"""
    t = t_axis(dur)
    n = len(t)
    vib = 1.0 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1.0, t / 0.25)
    phase = np.cumsum(freq * vib) / SR
    y = _saw(phase) * 0.6 + _saw(phase * 1.003 + 0.13) * 0.4
    y = lowpass(y, 0.16)
    # 弓の擦れノイズ（ごく微量）
    bow = highpass(rng.standard_normal(n), 0.4) * 0.015
    y = y + bow
    # エンベロープ: 遅いアタック→なだらかに減衰、終端はリリース
    e = np.exp(-t / (dur * 1.15))
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a) ** 1.5
    r = int(0.12 * SR)
    if r > 0:
        e[-r:] *= np.linspace(1, 0, r)
    return y * e * vol


def brass_note(freq, dur, vol=1.0):
    """金管風: ノコギリ波＋速いアタック、やや明るいローパス"""
    t = t_axis(dur)
    phase = np.cumsum(np.full_like(t, freq)) / SR
    y = _saw(phase) * 0.75 + np.sign(np.sin(2 * np.pi * freq * t)) * 0.25
    y = lowpass(y, 0.3)
    e = np.exp(-t / (dur * 0.9))
    a = int(0.02 * SR)
    e[:a] *= np.linspace(0, 1, a)
    r = int(0.08 * SR)
    if r > 0:
        e[-r:] *= np.linspace(1, 0, r)
    return y * e * vol


def timpani(dur=0.5, vol=1.0):
    """ティンパニ風: ピッチの下がる低音＋皮のノイズ"""
    hit = tone(105, dur, vol=vol, harmonics=(1.0, 0.4, 0.15),
               decay_tau=0.16, slide_to=52)
    n = int(dur * SR)
    noise = lowpass(rng.standard_normal(n), 0.05) * env_ad(n, decay_tau=0.05)
    return hit + noise * 0.5


# ---------------------------------------------------------------- 1. レバー
def gacha_lever():
    dur = 1.45
    buf = np.zeros(int(SR * dur))
    # ラチェット: クリック間隔が 加速→減速 する列（位相ベースで生成）
    total_phase = 26.0          # クリック総数ぶんの位相
    ts = np.linspace(0, 1, 2000)
    speed = 0.35 + 0.65 * np.sin(np.pi * ts) ** 0.8   # 0.35→1.0→0.35
    tmap = np.cumsum(speed)
    tmap = tmap / tmap[-1] * total_phase
    click_idx = np.arange(1, int(total_phase) + 1)
    click_phases = np.interp(click_idx, tmap, ts)
    click_times = 0.05 + click_phases * 1.07
    for ct in click_times:
        n = int(0.03 * SR)
        noise = rng.standard_normal(n)
        click = highpass(noise, 0.25) * env_ad(n, decay_tau=0.004)
        ping = tone(2300 + rng.uniform(-300, 300), 0.03, vol=0.35,
                    harmonics=(1.0, 0.3), decay_tau=0.006)
        amp = rng.uniform(0.55, 0.85)
        add(buf, (click * 0.9 + ping) * amp, ct)
    # 最後に低いノック「コトン」
    knock = tone(130, 0.22, vol=1.0, harmonics=(1.0, 0.35, 0.1), decay_tau=0.05)
    thump = lowpass(rng.standard_normal(int(0.06 * SR)), 0.08) * env_ad(int(0.06 * SR), decay_tau=0.015)
    add(buf, knock, 1.22)
    add(buf, thump * 1.2, 1.22)
    return buf


# ---------------------------------------------------------------- 2. カプセル落下
def capsule_drop():
    dur = 0.42
    buf = np.zeros(int(SR * dur))
    knock = tone(880, 0.11, vol=1.0, harmonics=(1.0, 0.5, 0.22, 0.1),
                 decay_tau=0.028, slide_to=430)
    add(buf, knock, 0.01)
    bounce = tone(720, 0.09, vol=0.45, harmonics=(1.0, 0.45, 0.18),
                  decay_tau=0.022, slide_to=380)
    add(buf, bounce, 0.20)
    roll_n = int(0.16 * SR)
    roll = lowpass(rng.standard_normal(roll_n), 0.05) * env_ad(roll_n, attack=0.01, decay_tau=0.05)
    add(buf, roll * 0.35, 0.24)
    return buf


# ---------------------------------------------------------------- 3. カプセル開封
def capsule_open():
    dur = 0.30
    buf = np.zeros(int(SR * dur))
    n = int(0.02 * SR)
    click = highpass(rng.standard_normal(n), 0.3) * env_ad(n, decay_tau=0.003)
    add(buf, click * 0.8, 0.005)
    pop = tone(280, 0.13, vol=1.0, harmonics=(1.0, 0.4, 0.15),
               decay_tau=0.035, slide_to=1250)
    add(buf, pop, 0.02)
    tap = tone(1500, 0.05, vol=0.3, harmonics=(1.0, 0.3), decay_tau=0.012)
    add(buf, tap, 0.16)
    return buf


# ---------------------------------------------------------------- 4. SSRファンファーレ（弦楽器）
def fanfare_ssr():
    dur = 1.45
    buf = np.zeros(int(SR * dur))
    C4, E4, G4 = 261.63, 329.63, 392.00
    C5, E5, G5, C6 = 523.25, 659.25, 783.99, 1046.50
    E6, G6, C7 = 1318.51, 1567.98, 2093.00
    # 土台: 弦の柔らかい和音パッド（C major）
    for f in (C4, E4, G4):
        add(buf, string_note(f, 1.38, vol=0.13, attack=0.15), 0.04)
    # 主旋律: 弦のアルペジオで上っていく
    for i, f in enumerate([C5, E5, G5, C6]):
        add(buf, string_note(f, 0.8, vol=0.5), 0.03 + i * 0.12)
    # 高音のきらめき: 軽いピッツィカート風の短い音列
    for i, f in enumerate([E6, G6, C7, G6]):
        sp = tone(f, 0.14, vol=0.16, harmonics=(1.0, 0.3), decay_tau=0.035)
        add(buf, sp, 0.92 + i * 0.07)
    # 締め: 弦の和音がふわっと残る
    for f in (C5, E5, G5, C6):
        add(buf, string_note(f, 0.55, vol=0.22, attack=0.06), 0.88)
    return buf


# ---------------------------------------------------------------- 5. LRファンファーレ（管弦楽）
def fanfare_lr():
    dur = 1.95
    buf = np.zeros(int(SR * dur))
    C4, E4, G4 = 261.63, 329.63, 392.00
    C5, E5, G5, C6 = 523.25, 659.25, 783.99, 1046.50
    E6, C7, E7 = 1318.51, 2093.00, 2637.02

    # ティンパニ＋金管スタッブ2発
    add(buf, timpani(0.5, vol=0.8), 0.01)
    for f in (C4, E4, G4, C5):
        add(buf, brass_note(f, 0.3, vol=0.34), 0.02)
    add(buf, timpani(0.45, vol=0.6), 0.20)
    for f in (C4, E4, G4, C5, E5):
        add(buf, brass_note(f, 0.32, vol=0.38), 0.21)
    # 弦の駆け上がり（速いアルペジオ）
    for i, f in enumerate([C4, E4, G4, C5, E5, G5, C6]):
        add(buf, string_note(f, 0.5, vol=0.42, attack=0.04), 0.44 + i * 0.085)
    # 土台の弦パッド
    for f in (C4, G4):
        add(buf, string_note(f, 1.0, vol=0.12, attack=0.12), 0.44)
    # クライマックス: 金管のロングトーン＋弦の和音
    add(buf, brass_note(C6, 0.72, vol=0.4), 1.12)
    add(buf, brass_note(G5, 0.72, vol=0.3), 1.12)
    for f in (C5, E5, G5, C6):
        add(buf, string_note(f, 0.78, vol=0.3, attack=0.05), 1.12)
    # きらめき（ピッツィカート風）
    for i, f in enumerate([E6, C7, E7, C7]):
        sp = tone(f, 0.14, vol=0.14, harmonics=(1.0, 0.3), decay_tau=0.03)
        add(buf, sp, 1.24 + i * 0.07)
    # 余韻（疑似リバーブ: 減衰エコー）
    echo = np.zeros_like(buf)
    for delay, g in ((0.09, 0.30), (0.19, 0.18), (0.31, 0.10)):
        d = int(delay * SR)
        echo[d:] += buf[:-d] * g * (np.arange(len(buf) - d) < int(0.5 * SR))
    return buf + echo


# ---------------------------------------------------------------- 音量調整
TARGET_RMS_DB = -19.0
PEAK_LIMIT = 10 ** (-1.0 / 20.0)   # -1 dBFS


def _smooth_gain(g, win=192):
    """ゲイン列に最小値フィルタ＋ローパスをかけ、なめらかな
    リミッター用ゲインカーブにする（ピーク付近だけを局所的に下げる）"""
    pad = np.pad(g, win, mode="edge")
    mins = np.lib.stride_tricks.sliding_window_view(pad, 2 * win + 1).min(axis=1)[: len(g)]
    y = np.empty_like(mins)
    acc = mins[0]
    for i, v in enumerate(mins):
        acc += 0.08 * (v - acc)
        y[i] = acc
    z = np.empty_like(y)
    acc = y[-1]
    for i in range(len(y) - 1, -1, -1):
        acc += 0.08 * (y[i] - acc)
        z[i] = acc
    return np.minimum(z, g)


def level_match(buf):
    """RMS を目標値に合わせ、ピークは -1dB リミッターで局所的に抑える。"""
    target = 10 ** (TARGET_RMS_DB / 20.0)
    for _ in range(3):
        rms = np.sqrt(np.mean(buf ** 2))
        buf = buf * (target / rms)
        over = np.abs(buf) > PEAK_LIMIT
        if np.any(over):
            g = np.minimum(1.0, PEAK_LIMIT / np.maximum(np.abs(buf), 1e-9))
            buf = buf * _smooth_gain(g)
    peak = np.max(np.abs(buf))
    if peak > PEAK_LIMIT:
        buf *= PEAK_LIMIT / peak
    return buf


def stats(buf):
    peak = np.max(np.abs(buf))
    rms = np.sqrt(np.mean(buf ** 2))
    return 20 * np.log10(peak), 20 * np.log10(rms)


def save_wav(name, buf):
    pcm = (np.clip(buf, -1, 1) * 32767).astype(np.int16)
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    pdb, rdb = stats(buf)
    print(f"{name}: peak {pdb:.2f} dBFS / RMS {rdb:.2f} dBFS")
    return path


if __name__ == "__main__":
    sounds = {
        "gacha_lever": gacha_lever(),
        "capsule_drop": capsule_drop(),
        "capsule_open": capsule_open(),
        "fanfare_ssr": fanfare_ssr(),
        "fanfare_lr": fanfare_lr(),
    }
    for name, buf in sounds.items():
        save_wav(name, level_match(buf))

