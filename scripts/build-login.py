"""Generate login with the current app shell: run after editing index.html."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
s=(root/'index.html').read_text()
start=s.index('<div id="tg-landing">')
end=s.index('    <aside id="tgSidebar">',start)
s=s[:start]+(root/'templates/login-content.html').read_text()+'\n'+s[end:]
s=re.sub(r'<title>.*?</title>','<title>Entrar — Total Gest</title>',s)
s=s.replace('content="index, follow"','content="noindex, follow"').replace('href="https://www.totalgest.pt/"','href="https://www.totalgest.pt/login.html"')
s=re.sub(r'<script src="landing-ui.js[^\"]*"></script>','',s)
# The private entry page is not a marketing SoftwareApplication result.
s=re.sub(r'<script type="application/ld\+json">.*?</script>', '', s, flags=re.S)
s=re.sub(r'(<meta property="og:url" content=")[^"]*', r'\g<1>https://www.totalgest.pt/login.html', s)
(root/'login.html').write_text(s)
