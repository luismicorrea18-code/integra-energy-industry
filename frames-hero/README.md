# frames-hero — carpeta para los 64 frames del hero (f001.jpg … f064.jpg)
# Extrae los frames de tu video con:
#   ffmpeg -i input.mp4 #     -vf "select=not(mod(n\,STEP)),scale=1920:1080" #     -vsync vfr -q:v 4 frames-hero/f%03d.jpg
# Donde STEP = total_frames_video / 64
# Recomienda resolución 1280×720 o 1920×1080, calidad -q:v 3-5 (menor = mejor)

