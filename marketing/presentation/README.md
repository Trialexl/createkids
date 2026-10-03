---
status: готово
priority: высокий
created: 2026-07-28
updated: 2026-07-28
tags:
  - маркетинг
  - презентация
  - визуал
---

# Визуальная презентация CreateKids

## Файлы

- `CreateKids-Визионеры.pptx` — презентация PowerPoint;
- `CreateKids-Визионеры.pdf` — версия для просмотра и отправки;
- `slides-png/` — 12 полноразмерных слайдов и контакт-лист;
- `create_visual_deck.py` — генератор визуальных слайдов;
- `build_deck.js` — сборщик PowerPoint со спикерскими заметками.

### Презентация проекта по заметке «Идеи»

- `CreateKids-Презентация-проекта.pptx` — 15-слайдовая презентация продукта;
- `CreateKids-Презентация-проекта.pdf` — версия для просмотра и отправки;
- `product-slides-png/` — исходные визуальные слайды и контакт-лист;
- `product-rendered-slides/` — проверочный рендер PDF и контакт-лист;
- `create_product_deck.py` — генератор визуальных слайдов и PDF;
- `build_product_deck.js` — сборщик PowerPoint со спикерскими заметками;
- `verify_product_deck.py` — проверка структуры и комплектности.

## Пересборка

```bash
python3 create_visual_deck.py
npm install
npm run build
```

## Пересборка презентации проекта

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm install
.venv/bin/python create_product_deck.py
npm run build:product
.venv/bin/python render_product_deck.py
.venv/bin/python verify_product_deck.py
```

Презентация использует редакционный коллаж и графику собственного производства. Фотографии реальных детей и сторонние материалы с неясной лицензией не используются.
