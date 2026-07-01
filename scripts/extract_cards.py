from __future__ import annotations

import json
import math
import re
import shutil
from pathlib import Path

import pandas as pd


WORKBOOK = Path(r"C:\Users\yangshichao\Documents\承天之弈svn\第一弹\牌表-录入需求\第一弹牌表录入校准版4.21.xlsx")
NORMAL_IMAGE_DIR = Path(r"C:\Users\yangshichao\Documents\临时暂存文件夹\集换社资料\TY01\普")
FOIL_IMAGE_DIR = Path(r"C:\Users\yangshichao\Documents\临时暂存文件夹\集换社资料\TY01\闪")
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CARD_DIR = ROOT / "assets" / "cards"


def clean(value):
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    text = str(value).replace("\t", "").strip()
    if text == "nan":
        return ""
    if text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    return text


def number(value):
    text = clean(value)
    if not text or text == "-":
        return 0
    try:
        return int(float(text))
    except ValueError:
        return 0


def card_id(raw):
    match = re.search(r"(TY01-(?:LS-)?\d+)", clean(raw))
    return match.group(1) if match else clean(raw)


def image_for(card_code: str) -> tuple[str, str]:
    normal = NORMAL_IMAGE_DIR / f"{card_code}.png"
    foil = FOIL_IMAGE_DIR / f"{card_code}.png"
    target = CARD_DIR / f"{card_code}.png"

    if normal.exists():
        shutil.copy2(normal, target)
        return f"assets/cards/{card_code}.png", "普"
    if foil.exists():
        shutil.copy2(foil, target)
        return f"assets/cards/{card_code}.png", "闪"
    return "", ""


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CARD_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_excel(WORKBOOK, sheet_name="第一弹全牌表")
    cards = []
    used_images = set()

    for _, row in df.iterrows():
        code = card_id(row["系列编号"])
        image, image_kind = image_for(code)
        if image:
            used_images.add(code)
        cards.append(
            {
                "id": code,
                "serial": clean(row["系列编号"]),
                "title": clean(row["称号"]),
                "name": clean(row["名称"]),
                "traditionalName": clean(row["繁体名称"]),
                "rarity": clean(row["稀有度"]),
                "faction": clean(row["势力"]),
                "type": clean(row["类别"]),
                "cost": number(row["费用"]),
                "skill": clean(row["技能描述"]),
                "timing": clean(row["颜色底备注"]),
                "upgrade": clean(row["升级条件及效果"]),
                "flavor": clean(row["风味文字"]),
                "artist": clean(row["画师"]),
                "specialUi": clean(row["棋子特殊UI"]),
                "trialDeck": clean(row["是否试玩卡组"]),
                "trialCount": number(row["试玩张数"]),
                "starterDeck": clean(row["是否预组卡组"]),
                "starterCount": number(row["预组张数"]),
                "image": image,
                "imageKind": image_kind,
            }
        )

    extras = []

    payload = {
        "source": {
            "workbook": str(WORKBOOK),
            "imageFolder": str(NORMAL_IMAGE_DIR),
            "generatedAt": pd.Timestamp.now().isoformat(timespec="seconds"),
            "notes": "TY01-217 普通图缺失时可手动指定替换图。",
        },
        "cards": cards,
        "extras": extras,
    }

    (DATA_DIR / "cards.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"cards": len(cards), "extras": len(extras)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

