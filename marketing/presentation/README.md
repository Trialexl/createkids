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

### История родителей и происхождение CreateKids

- `CreateKids-Презентация-проекта.pptx` — 14-слайдовая история основателей;
- `CreateKids-Презентация-проекта.pdf` — версия для просмотра и отправки;
- `product-slides-png/` — исходные визуальные слайды и контакт-лист;
- `product-rendered-slides/` — проверочный рендер PDF и контакт-лист;
- `create_product_deck.py` — генератор истории родителей, визуальных слайдов и PDF;
- `build_product_deck.js` — сборщик PowerPoint со спикерскими заметками;
- `verify_product_deck.py` — проверка структуры и комплектности.

Презентация раскрывает две ключевые главы из `Идеи.md`: «Откуда появилась идея» и «Почему эта идея стоит того». Продукт появляется как следствие родительского поиска, а не как исходная точка рассказа.

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
