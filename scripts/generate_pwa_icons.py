from pathlib import Path
from io import BytesIO
import cairosvg
from PIL import Image

root=Path(__file__).resolve().parent.parent
logo=(root/'public/nabt-logo.svg').read_bytes()
out=root/'public/icons'
out.mkdir(parents=True,exist_ok=True)

def render(size, inset, background, filename):
    glyph=int(size*(1-2*inset))
    png=cairosvg.svg2png(bytestring=logo,output_width=glyph,output_height=glyph)
    mark=Image.open(BytesIO(png)).convert('RGBA')
    mark.thumbnail((glyph,glyph),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(size,size),background)
    canvas.alpha_composite(mark,((size-mark.width)//2,(size-mark.height)//2))
    canvas.save(out/filename,optimize=True)

render(32,0.03,(0,0,0,0),'favicon-32.png')
render(180,0.10,(247,250,247,255),'apple-touch-icon.png')
render(192,0.10,(247,250,247,255),'icon-192.png')
render(512,0.10,(247,250,247,255),'icon-512.png')
render(512,0.21,(247,250,247,255),'maskable-512.png')
