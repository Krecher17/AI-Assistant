"""Persistent, offline-only command transcription. Audio remains in memory."""
import base64, io, json, sys
from faster_whisper import WhisperModel
model = WhisperModel(sys.argv[1], device="cpu", compute_type="int8", cpu_threads=2, num_workers=1, local_files_only=True)
print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    try:
        request=json.loads(line)
        segments, _ = model.transcribe(io.BytesIO(base64.b64decode(request["audio"])), language="en", beam_size=1, vad_filter=True, condition_on_previous_text=False, initial_prompt="Grim, Akshay, Brave, YouTube, GitHub, Calculator, open, search.")
        print(json.dumps({"id":request["id"],"text":" ".join(s.text.strip() for s in segments).strip()}), flush=True)
    except Exception as error:
        print(json.dumps({"id":request.get("id"),"error":str(error)}), flush=True)
