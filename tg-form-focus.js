/* Apply the same form sizing inside same-origin modules and report frames. */
(function () {
    'use strict';
    const source = document.currentScript?.src || location.href;
    const stylesheet = new URL('tg-form-focus.css?v=1.2.1', source).href;
    const documents = new WeakSet();
    const originalSizes = new WeakMap();
    const controls = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]):not([type=file]),select,textarea,[contenteditable="true"],[contenteditable="plaintext-only"],[contenteditable=""]';

    function prepareControl(event) {
        const field = event.target?.closest?.(controls);
        if (!field || field.disabled || field.readOnly) return;
        const win = field.ownerDocument.defaultView;
        if (!win || win.matchMedia('print').matches) return;
        if (!win.navigator.maxTouchPoints && !win.matchMedia('(max-width:900px), (any-pointer:coarse)').matches) return;

        // 16 CSS pixels alone are insufficient when the page or a container is
        // reduced. Size the text BEFORE the browser's default tap-to-focus action.
        // Never change the viewport, prevent the tap, or reset the user's zoom.
        let scale = 1;
        let topWindow = win;
        let node = field;
        while (node) {
            const owner = node.ownerDocument.defaultView;
            const zoom = parseFloat(owner.getComputedStyle(node).zoom);
            if (zoom > 0) scale *= zoom;
            if (node.parentElement) node = node.parentElement;
            else {
                try { node = owner.frameElement; } catch (_) { node = null; }
                if (node) topWindow = node.ownerDocument.defaultView;
            }
        }
        const viewport = topWindow.visualViewport;
        if (viewport) {
            // screen.width is not the layout viewport: iPad landscape, desktop
            // windows and the on-screen keyboard can give unrelated dimensions.
            // Dividing those widths inflated normal fields (and kept them large).
            // Use only the browser's actual scale, independent of orientation.
            scale *= Math.min(1, viewport.scale || 1);
        }
        if (!originalSizes.has(field)) originalSizes.set(field, parseFloat(win.getComputedStyle(field).fontSize) || 16);
        const minimum = Math.max(originalSizes.get(field), Math.ceil(16 / Math.min(1, scale) * 100) / 100);
        const size = minimum + 'px';
        if (field.style.getPropertyValue('--tg-form-focus-min') !== size) field.style.setProperty('--tg-form-focus-min', size);
        if (!field.hasAttribute('data-tg-form-focus-sized')) field.setAttribute('data-tg-form-focus-sized', '');
    }

    function prepareFrame(frame) {
        try {
            if (frame.contentDocument) prepare(frame.contentDocument);
        } catch (_) { /* A remote attachment keeps its own presentation. */ }
    }

    function prepare(doc) {
        if (!doc.head || documents.has(doc)) return;
        documents.add(doc);
        if (!doc.getElementById('tg-form-focus-style')) {
            const link = doc.createElement('link');
            link.id = 'tg-form-focus-style';
            link.rel = 'stylesheet';
            link.href = stylesheet;
            doc.head.appendChild(link);
        }
        // Prepare inserted fields before the first tap, including the compulsory
        // exit sheet and material rows. Native iOS focus may precede focusin.
        let pending = false;
        const refresh = () => {
            if (pending) return;
            pending = true;
            doc.defaultView.requestAnimationFrame(() => {
                pending = false;
                doc.querySelectorAll(controls).forEach(field => prepareControl({target:field}));
            });
        };
        const observer = new doc.defaultView.MutationObserver(records => {
            if (records.some(r => r.type === 'childList' || !r.target.matches?.(controls))) refresh();
        });
        observer.observe(doc.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style']});
        doc.defaultView.addEventListener('resize', refresh);
        doc.defaultView.visualViewport?.addEventListener('resize', refresh);
        doc.addEventListener('DOMContentLoaded', refresh, {once:true});
        refresh();
        // Capture iframe loads, including srcdoc reports created after opening a modal.
        doc.addEventListener('load', event => {
            if (event.target?.localName === 'iframe') prepareFrame(event.target);
        }, true);
        doc.querySelectorAll('iframe').forEach(prepareFrame);
        // Delegation also covers materials/hours added after opening a work sheet.
        doc.addEventListener('pointerdown', prepareControl, true);
        doc.addEventListener('touchstart', prepareControl, { capture: true, passive: true });
        doc.addEventListener('focusin', prepareControl, true);
    }

    prepare(document);
})();
