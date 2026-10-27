/* Android fallback for agenda HTML drag-and-drop. A short swipe still scrolls;
   hold a movable card for 350ms, then drag. Reuse the existing drop handlers. */
(function () {
    'use strict';
    if (!/Android/i.test(navigator.userAgent)) return;
    let gesture = null, suppress = null;
    function fire(target, type, transfer) {
        const event = new Event(type, {bubbles:false, cancelable:true});
        Object.defineProperty(event, 'dataTransfer', {value:transfer});
        target.dispatchEvent(event);
    }
    function targetAt(g) {
        return document.elementFromPoint(g.x, g.y)?.closest('[data-tg-agenda-drop]') || null;
    }
    function highlight(g) {
        const target = targetAt(g);
        if (g.target !== target) {
            g.target?.classList.remove('ag-drop');
            g.target = target;
            target?.classList.add('ag-drop');
        }
    }
    function scroll(g) {
        if (gesture !== g || !g.active) return;
        // Scroll nested week/Gantt containers first, then the page at its edges.
        const elements = [];
        for (let node = g.target || g.card.parentElement; node && node !== document.body; node = node.parentElement) elements.push(node);
        elements.push(document.scrollingElement);
        for (const axis of ['x', 'y']) {
            for (const el of elements) {
                if (!el) continue;
                const page = el === document.scrollingElement;
                const style = getComputedStyle(el);
                if (!page && !/(auto|scroll)/.test(axis === 'x' ? style.overflowX : style.overflowY)) continue;
                const r = page ? {left:0,top:0,right:innerWidth,bottom:innerHeight} : el.getBoundingClientRect();
                const pos = axis === 'x' ? g.x : g.y;
                const low = axis === 'x' ? Math.max(0,r.left) : Math.max(0,r.top);
                const high = axis === 'x' ? Math.min(innerWidth,r.right) : Math.min(innerHeight,r.bottom);
                const delta = pos < low + 36 ? -8 : pos > high - 36 ? 8 : 0;
                if (!delta) continue;
                const prop = axis === 'x' ? 'scrollLeft' : 'scrollTop';
                const before = el[prop]; el[prop] += delta;
                if (el[prop] !== before) break;
            }
        }
        highlight(g);
        g.raf = requestAnimationFrame(() => scroll(g));
    }
    function cleanup(drop) {
        const g = gesture; if (!g) return;
        gesture = null;
        clearTimeout(g.timer); cancelAnimationFrame(g.raf);
        g.ghost?.remove(); g.card.classList.remove('tg-agenda-touch-moving');
        g.target?.classList.remove('ag-drop');
        if (g.active) {
            suppress = {until:Date.now()+500,x:g.x,y:g.y};
            // Both normal and Gantt drop handlers keep their own checks/dialogs.
            if (drop && g.target?.isConnected) fire(g.target, 'drop', g.transfer);
            fire(g.card, 'dragend', g.transfer);
        }
    }
    document.addEventListener('touchstart', event => {
        if (gesture || event.touches.length !== 1) { cleanup(false); return; }
        const card = event.target.closest?.('[data-tg-agenda-drag][draggable="true"]');
        if (!card || event.target.closest('input,textarea,select,button,a,[contenteditable]')) return;
        const t = event.touches[0];
        const g = gesture = {card,id:t.identifier,x:t.clientX,y:t.clientY,startX:t.clientX,startY:t.clientY,active:false};
        g.timer = setTimeout(() => {
            if (gesture !== g || !card.isConnected) { cleanup(false); return; }
            g.transfer = new DataTransfer();
            fire(card, 'dragstart', g.transfer);
            // No ID is set if the existing permission checks reject this gesture.
            if (!g.transfer.getData('text/plain')) { cleanup(false); return; }
            g.active = true;
            const rect = card.getBoundingClientRect();
            g.ghost = card.cloneNode(true);
            g.ghost.removeAttribute('id');
            g.ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
            g.ghost.setAttribute('aria-hidden','true');
            g.ghost.style.cssText = `position:fixed;z-index:500001;pointer-events:none;opacity:.85;width:${Math.min(rect.width,280)}px;max-height:160px;overflow:hidden;background:#fff;border:2px solid #152a52;border-radius:10px;padding:8px;box-sizing:border-box;left:${g.x+12}px;top:${g.y+12}px;`;
            document.body.appendChild(g.ghost);
            card.classList.add('tg-agenda-touch-moving');
            highlight(g); scroll(g);
        },350);
    },{passive:true});
    document.addEventListener('touchmove', event => {
        const g=gesture; if (!g) return;
        if (event.touches.length !== 1) { cleanup(false); return; }
        const t=Array.from(event.touches).find(t=>t.identifier===g.id); if (!t) { cleanup(false); return; }
        g.x=t.clientX; g.y=t.clientY;
        if (!g.active) {
            if (Math.hypot(g.x-g.startX,g.y-g.startY)>10) cleanup(false);
            return;
        }
        event.preventDefault();
        g.ghost.style.left=(g.x+12)+'px';g.ghost.style.top=(g.y+12)+'px';
        highlight(g);
    },{passive:false});
    document.addEventListener('touchend', event => {
        const g=gesture; if (!g) return;
        if (g.active) { event.preventDefault(); highlight(g); }
        cleanup(true);
    },{passive:false});
    document.addEventListener('touchcancel',()=>cleanup(false),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup(false)});
    window.addEventListener('blur',()=>cleanup(false));
    document.addEventListener('contextmenu',event=>{if(gesture?.card.contains(event.target))event.preventDefault()},true);
    document.addEventListener('dragstart',event=>{if(event.isTrusted && gesture)event.preventDefault()},true);
    document.addEventListener('click',event=>{
        if(suppress && Date.now()<suppress.until && Math.hypot(event.clientX-suppress.x,event.clientY-suppress.y)<30){event.preventDefault();event.stopImmediatePropagation();}
    },true);
})();
