import json
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
boards=json.loads(Path('docs/silhouettes/masks.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',17)
def sheet(items,cols,tilew,tileh,filename):
 im=Image.new('RGB',(cols*tilew,((len(items)+cols-1)//cols)*tileh),'#f6f7f2');d=ImageDraw.Draw(im)
 for i,b in enumerate(items):
  ox=i%cols*tilew;oy=i//cols*tileh;scale=min((tilew-35)/b['width'],(tileh-45)/b['height']);x0=ox+(tilew-b['width']*scale)/2;y0=oy+10+(tileh-45-b['height']*scale)/2
  for y,row in enumerate(b['mask']):
   for x,v in enumerate(row):
    if v=='1':d.rectangle((round(x0+x*scale),round(y0+y*scale),round(x0+(x+1)*scale),round(y0+(y+1)*scale)),fill='#26372b')
  d.text((ox+tilew/2,oy+tileh-25),b['shapeLabel'],font=font,fill='#46583c',anchor='mm')
 im.save(filename)
sheet(boards[4::5],5,220,220,'docs/silhouettes/overview-20.png')
sheet(boards,5,180,170,'docs/silhouettes/all-100.png')
