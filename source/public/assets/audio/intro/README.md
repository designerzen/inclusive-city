# Start-screen recordings

Single-sentence excerpts from the original MP3s in the parent folder. The originals
are preserved. These edits omit repeated takes and long pauses.

Source intervals in seconds:

| Voice | Start | End |
| --- | ---: | ---: |
| ajay | 0.20 | 2.95 |
| craig | 0 | 2.15 |
| gosia | 0 | 2.70 |
| helen | 0.25 | 2.05 |
| janet | 0 | 2.40 |
| kanchan | 0.40 | 3.00 |
| kate | 6.85 | 9.30 |
| nick | 0 | 2.10 |
| nicola | 0.35 | 3.70 |
| paul | 3.65 | 5.80 |

Encoded with FFmpeg using `-ss START -t DURATION -map_metadata -1 -codec:a libmp3lame -q:a 2`.
