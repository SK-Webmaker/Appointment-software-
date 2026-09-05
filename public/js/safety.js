// One client's treatment record: contraindications, patch tests, consents and
// photos, with the printable export that exists for the day somebody makes a
// claim.
//
// Kept behind a press rather than shown on the client's card, and that is a
// decision rather than a layout choice. This is health information. An owner
// opening a client to check their phone number should not have somebody's
// medication list on screen in front of whoever is standing at the counter.
//
// The one exception is a recorded reaction, which is flagged on the card
// itself — a fact that must never be one press away from being missed.
import { api } from './api.js';
import { esc, icon, openModal, confirmDialog, toast, fmtDate, todayStr } from './ui.js';

/**
 * Shrink a photo in the browser before it is ever uploaded.
 *
 * A phone camera photo is 3–6 MB. Stored as a data URI on a 1 GB disk, a busy
 * salon fills that in months and the failure arrives as bookings that stop
 * saving. So the resize happens here, where the pixels already are, and the
 * server's cap is the backstop rather than the thing the owner meets.
 *
 * Quality steps down until it fits. Giving up loudly is right: a photo silently
 * saved at a size nobody can see anything in is worse than being told to try a
 * smaller one.
 */
export function shrinkImage(file, { maxEdge = 1280, maxBytes = 400 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('That is not an image')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image'));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        // White behind it: a PNG with transparency turns black as a JPEG, which
        // is a surprising way to lose the evidence in a photo.
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        for (const q of [0.82, 0.7, 0.58, 0.45, 0.34]) {
          const uri = canvas.toDataURL('image/jpeg', q);
          // 4 base64 characters per 3 bytes.
          if ((uri.length - uri.indexOf(',') - 1) * 3 / 4 <= maxBytes) { resolve(uri); return; }
        }
        reject(new Error('That photo is too large even after shrinking — try a smaller one'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * The one line that belongs on the client's card.
 *
 * Only ever shown when there is something to say. A record with nothing in it
 * gets no banner, because a row reading "nothing recorded" on every client
 * teaches an owner to stop reading the row.
 */
export function safetyFlagHtml(rec) {
  if (!rec) return '';
  const bits = [];
  const reaction = (rec.patch_tests || []).find((t) => t.result === 'fail');
  if (reaction) bits.push({ tone: 'bad', text: `Patch test reaction recorded ${fmtDate(reaction.tested_on, { weekday: false })}` });
  const expired = (rec.patch_standing || []).filter((p) => p.state === 'expired');
  if (expired.length) bits.push({ tone: 'warn', text: `Patch test expired for ${expired.map((p) => p.service_name).join(', ')}` });
  const f = rec.flags || {};
  const notes = [f.allergies && `allergies: ${f.allergies}`, f.medications && `medication: ${f.medications}`,
    f.conditions && f.conditions, f.pregnant && 'pregnant / breastfeeding'].filter(Boolean);
  if (notes.length) bits.push({ tone: 'warn', text: notes.join(' · ') });
  if (!bits.length) return '';
  return bits.map((b) => `<div class="safety-flag ${b.tone === 'bad' ? 'bad' : ''}">${icon('alert', 13)} ${esc(b.text)}</div>`).join('');
}

const stateWords = {
  ok: 'Valid', expired: 'Expired', none: 'None on file', failed: 'Reaction recorded',
};

export async function openSafetyModal({ client, onChanged }) {
  const id = client.id;
  const name = `${client.first_name} ${client.last_name || ''}`.trim();
  let rec = await api.get(`/api/clients/${id}/safety`);
  let services = [];
  try { services = await api.get('/api/services'); } catch { services = []; }
  // Which services ask for written consent, in one request rather than one per
  // service. A salon with fifteen services would otherwise fire fifteen calls
  // to open a record — on a phone in a salon, that is the difference between
  // instant and a spinner.
  let consentServices = [];
  try {
    const ov = await api.get('/api/safety/overview');
    const wants = new Set((ov?.requirements || [])
      .filter((r) => r.kind === 'consent' && r.consent_text)
      .map((r) => r.service_id));
    consentServices = services.filter((sv) => wants.has(sv.id));
  } catch { consentServices = []; }
  const appts = (client.appointments || []).slice(0, 30);

  const m = openModal({
    title: `${name} — treatment record`,
    wide: true,
    body: '<div id="sf-body"></div>',
    footer: `
      <button class="btn" id="sf-print">${icon('download')} Print / save full record</button>
      <div class="spacer"></div>
      <button class="btn primary" id="sf-close-btn">${icon('check')} Done</button>`,
  });

  const f = () => rec.flags || {};
  const paint = () => {
    m.querySelector('#sf-body').innerHTML = `
      <div class="sf-note">Kairo keeps these records. It never decides whether a treatment is safe for
        anybody — that judgement is yours, and this is the paperwork behind it.</div>

      <div class="mini-label" style="margin:16px 0 6px">Safety record</div>
      <form id="sf-flags" class="form-grid">
        <div class="field span2">
          <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
            <input type="checkbox" name="pregnant" class="chk" ${f().pregnant ? 'checked' : ''}>
            Pregnant or breastfeeding</label></div>
        <div class="field span2"><label>Known allergies</label>
          <input name="allergies" value="${esc(f().allergies || '')}" placeholder="PPD, latex…"></div>
        <div class="field span2"><label>Medication</label>
          <input name="medications" value="${esc(f().medications || '')}" placeholder="Roaccutane, blood thinners…"></div>
        <div class="field span2"><label>Skin or health conditions</label>
          <input name="conditions" value="${esc(f().conditions || '')}" placeholder="Eczema on the scalp…"></div>
        <div class="field span2"><label>Notes</label>
          <textarea name="notes" rows="2">${esc(f().notes || '')}</textarea></div>
        <div class="field span2" style="display:flex;align-items:center;gap:10px">
          <button type="button" class="btn primary small" id="sf-save-flags">${icon('check', 13)} Save</button>
          <span class="cell-sub">${f().updated_at ? `Last updated ${esc(f().updated_at)}${f().updated_by ? ` by ${esc(f().updated_by)}` : ''}` : 'Nothing recorded yet'}</span>
        </div>
      </form>

      <div class="mini-label" style="margin:20px 0 6px">Patch tests</div>
      ${(rec.patch_standing || []).length ? `<div class="sf-standing">${rec.patch_standing.map((p) => `
        <span class="chip ${p.state === 'failed' ? 'chip-bad' : p.state === 'ok' ? 'chip-ok' : ''}">${esc(p.service_name)}: ${esc(stateWords[p.state] || p.state)}${p.state === 'ok' && p.expires_on ? ` to ${esc(p.expires_on)}` : ''}</span>`).join('')}</div>` : ''}
      ${(rec.patch_tests || []).length ? (rec.patch_tests || []).map((t) => `
        <div class="list-item" style="cursor:default">
          <div style="flex:1">
            <div class="cell-main">${t.result === 'fail' ? '<b style="color:var(--red)">Reaction</b>' : 'Pass'}
              · ${esc(t.tested_on)}</div>
            <div class="cell-sub">${esc(t.service_name || 'All services')}${t.product ? ` · ${esc(t.product)}` : ''}${t.recorded_by ? ` · ${esc(t.recorded_by)}` : ''}${t.note ? ` · ${esc(t.note)}` : ''}</div>
          </div>
          <button class="btn small danger" data-del-test="${t.id}">${icon('trash', 13)}</button>
        </div>`).join('') : '<div class="cell-sub" style="padding:6px 0">No patch tests recorded.</div>'}
      <form id="sf-test" class="form-grid" style="margin-top:10px">
        <div class="field"><label>Date tested</label>
          <input name="tested_on" type="date" value="${esc(todayStr())}" max="${esc(todayStr())}"></div>
        <div class="field"><label>Result</label>
          <select name="result"><option value="pass">Pass — no reaction</option><option value="fail">Reaction</option></select></div>
        <div class="field"><label>Service</label>
          <select name="service_id"><option value="">All services</option>
            ${services.map((sv) => `<option value="${sv.id}">${esc(sv.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Product</label>
          <input name="product" placeholder="Wella Koleston 6/0"></div>
        <div class="field span2"><label>Note</label>
          <input name="note" placeholder="Checked at 48 hours, no redness"></div>
        <div class="field span2">
          <button type="button" class="btn small" id="sf-add-test">${icon('plus', 13)} Record this patch test</button></div>
      </form>

      <div class="mini-label" style="margin:20px 0 6px">Consents</div>
      ${(rec.consents || []).length ? (rec.consents || []).map((cs) => `
        <div class="sf-consent">
          <div><b>${esc(cs.service_name || 'Service')}</b> — agreed by ${esc(cs.typed_name)} on ${esc(cs.agreed_at)}${cs.taken_by ? ` (${esc(cs.taken_by)})` : ''}</div>
          <div class="sf-words">${esc(cs.body)}</div>
        </div>`).join('') : '<div class="cell-sub" style="padding:6px 0">No consents recorded.</div>'}
      ${consentServices.length ? `
        <form id="sf-consent" class="form-grid" style="margin-top:10px">
          <div class="field"><label>Service</label>
            <select name="service_id">${consentServices.map((sv) => `<option value="${sv.id}">${esc(sv.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Name they gave</label>
            <input name="typed_name" placeholder="Their full name"></div>
          <div class="field span2">
            <button type="button" class="btn small" id="sf-add-consent">${icon('plus', 13)} Record consent taken in person</button>
            <div class="hint">Uses the wording set on that service right now. A typed name and a
              timestamp is a record of consent, not a witnessed signature.</div></div>
        </form>` : '<div class="hint">No service asks for written consent yet — set one on the service itself.</div>'}

      <div class="mini-label" style="margin:20px 0 6px">Photos</div>
      <div id="sf-photos" class="sf-photos"></div>
      ${appts.length ? `
        <div class="form-grid" style="margin-top:10px">
          <div class="field"><label>Attach to</label>
            <select id="sf-photo-appt">${appts.map((a) => `<option value="${a.id}">${esc(fmtDate(a.date, { weekday: false }))} · ${esc(a.service_name || 'Appointment')}</option>`).join('')}</select></div>
          <div class="field"><label>Before or after</label>
            <select id="sf-photo-kind"><option value="after">After</option><option value="before">Before</option></select></div>
          <div class="field span2">
            <button type="button" class="btn small" id="sf-photo-pick">${icon('upload', 13)} Add a photo</button>
            <input type="file" id="sf-photo-file" accept="image/*" style="display:none">
            <div class="hint">Shrunk on this device before it is sent — the disk holding your whole
              business is 1 GB, and full-size camera photos would fill it.</div></div>
        </div>` : '<div class="cell-sub">Photos attach to an appointment, and this client has none yet.</div>'}`;

    wire();
    drawPhotos();
  };

  async function drawPhotos() {
    const box = m.querySelector('#sf-photos');
    if (!box) return;
    const list = rec.photos || [];
    if (!list.length) { box.innerHTML = '<div class="cell-sub">No photos.</div>'; return; }
    box.innerHTML = list.map((p) => `
      <figure class="sf-photo" data-photo="${p.id}">
        <div class="sf-photo-img" data-img="${p.id}"></div>
        <figcaption>${esc(p.kind)} · ${esc(String(p.created_at).slice(0, 10))}
          <button class="lnk" data-del-photo="${p.id}">Remove</button></figcaption>
      </figure>`).join('');
    // The images come one at a time rather than inside the record, so opening
    // somebody with twenty photos is not ten megabytes of JSON before anything
    // appears on screen.
    for (const p of list) {
      try {
        const full = await api.get(`/api/photos/${p.id}`);
        const slot = box.querySelector(`[data-img="${p.id}"]`);
        if (slot && full?.image) slot.innerHTML = `<img src="${esc(full.image)}" alt="">`;
      } catch { /* one photo failing should not take the record with it */ }
    }
    box.querySelectorAll('[data-del-photo]').forEach((b) => {
      b.onclick = async () => {
        const ok = await confirmDialog('Remove photo', 'Delete this photo permanently?', { danger: true, okText: 'Delete' });
        if (!ok) return;
        try {
          await api.del(`/api/photos/${b.dataset.delPhoto}`);
          rec = await api.get(`/api/clients/${id}/safety`);
          paint();
          toast('Photo removed');
        } catch (err) { toast(err.message, 'err'); }
      };
    });
  }

  function wire() {
    m.querySelector('#sf-save-flags').onclick = async () => {
      const fd = new FormData(m.querySelector('#sf-flags'));
      try {
        rec = await api.put(`/api/clients/${id}/safety`, {
          pregnant: fd.get('pregnant') === 'on',
          allergies: fd.get('allergies') || '', medications: fd.get('medications') || '',
          conditions: fd.get('conditions') || '', notes: fd.get('notes') || '',
        });
        paint();
        toast('Safety record saved');
        onChanged?.();
      } catch (err) { toast(err.message, 'err'); }
    };

    m.querySelector('#sf-add-test').onclick = async () => {
      const fd = new FormData(m.querySelector('#sf-test'));
      if (!fd.get('tested_on')) { toast('Give the date the test was done', 'err'); return; }
      if (fd.get('result') === 'fail') {
        const ok = await confirmDialog('Record a reaction',
          'This closes online booking for services needing a patch test, and stays on their record. Go ahead?',
          { danger: true, okText: 'Record the reaction' });
        if (!ok) return;
      }
      try {
        rec = await api.post(`/api/clients/${id}/patch-tests`, {
          service_id: Number(fd.get('service_id')) || undefined,
          tested_on: fd.get('tested_on'), result: fd.get('result'),
          product: fd.get('product') || '', note: fd.get('note') || '',
        });
        paint();
        toast('Patch test recorded');
        onChanged?.();
      } catch (err) { toast(err.message, 'err'); }
    };

    m.querySelectorAll('[data-del-test]').forEach((b) => {
      b.onclick = async () => {
        const test = (rec.patch_tests || []).find((t) => String(t.id) === b.dataset.delTest);
        const reaction = test?.result === 'fail';
        const ok = await confirmDialog(reaction ? 'Remove a recorded reaction' : 'Remove patch test',
          reaction
            ? 'This is the record of a reaction. If a claim is ever made it is the evidence that '
              + 'the salon knew. Remove it only if it was entered by mistake.'
            : 'Delete this patch test?',
          { danger: true, okText: reaction ? 'Remove it anyway' : 'Delete' });
        if (!ok) return;
        try {
          rec = await api.del(`/api/patch-tests/${b.dataset.delTest}${reaction ? '?confirm=remove-reaction' : ''}`);
          paint();
          toast('Removed');
          onChanged?.();
        } catch (err) { toast(err.message, 'err'); }
      };
    });

    const consentBtn = m.querySelector('#sf-add-consent');
    if (consentBtn) {
      consentBtn.onclick = async () => {
        const fd = new FormData(m.querySelector('#sf-consent'));
        if (!String(fd.get('typed_name') || '').trim()) { toast('Whose consent is this?', 'err'); return; }
        try {
          rec = await api.post(`/api/clients/${id}/consents`, {
            service_id: Number(fd.get('service_id')), typed_name: fd.get('typed_name'),
          });
          paint();
          toast('Consent recorded');
        } catch (err) { toast(err.message, 'err'); }
      };
    }

    const pick = m.querySelector('#sf-photo-pick');
    if (pick) {
      const file = m.querySelector('#sf-photo-file');
      pick.onclick = () => file.click();
      file.onchange = async () => {
        if (!file.files[0]) return;
        pick.disabled = true;
        try {
          const image = await shrinkImage(file.files[0]);
          await api.post(`/api/appointments/${m.querySelector('#sf-photo-appt').value}/photos`, {
            image, kind: m.querySelector('#sf-photo-kind').value,
          });
          rec = await api.get(`/api/clients/${id}/safety`);
          paint();
          toast('Photo added');
        } catch (err) { toast(err.message, 'err'); }
        pick.disabled = false;
        file.value = '';
      };
    }
  }

  paint();

  // A document, not a download: it opens in its own tab so it can be read,
  // printed, or saved as a PDF by whoever needs it.
  m.querySelector('#sf-print').onclick = () => {
    window.open(`/api/clients/${id}/record`, '_blank', 'noopener');
  };
  m.querySelector('#sf-close-btn').onclick = () => m.close();
}
