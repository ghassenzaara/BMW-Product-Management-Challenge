# Car pictures for the Vehicle plan

The Vehicle plan shows each car in a small card as a still picture (`web/public/models/*-still.webp`), so the
page runs no WebGL and no animation for it. The real 3D view loads only on click.

The same tool can render a turntable sheet (many angles in one WebP) if one is wanted later: pass more frames.

Make or refresh a picture after a model changes:

```
DEPS_DIR=<folder whose node_modules has puppeteer-core and sharp> \
THREE_DIR=<path to node_modules/three> \
node render-turntable.mjs <model.glb> <out.webp> <front> <length> 1 1 <start>
```

| car | model | front | length | start |
|---|---|---|---|---|
| 5 Series | `web/public/models/g60-i5.glb` | `-x` | 5.06 | 0 |
| 7 Series | `web/public/models/g70-i7.glb` | `-z` | 5.39 | 180 |

`front` says which way the car's nose points in the file, `start` turns the picture (degrees).
The picture is 640 x 240 px, transparent, with a soft shadow, lit like the app's 3D view.