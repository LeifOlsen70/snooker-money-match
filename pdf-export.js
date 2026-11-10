function renderPdfPages(total, paintPage) {
  const width = 595, height = 842;
  const chunks = [];
  const offsets = [0];
  let length = 0;
  function append(chunk) {
    chunks.push(chunk);
    length += typeof chunk === 'string' ? chunk.length : chunk.byteLength;
  }
  function object(id, ...content) {
    offsets[id] = length;
    append(id + ' 0 obj\n');
    content.forEach(append);
    append('\nendobj\n');
  }
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = Array.from({length:total}, (_, i) => (3 + 3 * i) + ' 0 R');
  object(2, `<< /Type /Pages /Count ${total} /Kids [${kids.join(' ')}] >>`);
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  for (let page = 0; page < total; page++) {
    paintPage(ctx, page);
    const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', .92).split(',')[1]), c => c.charCodeAt(0));
    const id = 3 + page * 3;
    const stream = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`;
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    object(id+1, `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream');
    object(id+2, `<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }
  const xref = length;
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) append(String(offset).padStart(10, '0') + ' 00000 n \n');
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return chunks;
}

function accountingPdf(title, subtitle, sections) {
  const margin = 36, contentWidth = 523, bottom = 795, rowHeight = 22;
  const pages = [[]];
  let y = 92;
  for (const section of sections) {
    const {title, note, headers, weights, rows} = section;
    const headingHeight = note ? 46 : 29;
    let start = 0;
    do {
      const minHeight = headingHeight + (rows.length ? 2 * rowHeight : 0);
      if (y + minHeight > bottom) {
        pages.push([]);
        y = 92;
      }
      const capacity = Math.floor((bottom - y - headingHeight - rowHeight) / rowHeight);
      const visibleRows = rows.slice(start, start + capacity);
      pages.at(-1).push({
        title: start ? title + ' (Fortsetzung)' : title,
        note, headers, weights, rows: visibleRows, y, headingHeight
      });
      y += headingHeight + (visibleRows.length ? rowHeight * (visibleRows.length + 1) : 0) + 17;
      start += visibleRows.length;
    } while (start < rows.length);
  }
  return renderPdfPages(pages.length, (ctx, page) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 595, 842);
    ctx.fillStyle = '#21152e';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(title, margin, 52, contentWidth);
    ctx.fillStyle = '#51465b';
    ctx.font = '11px sans-serif';
    ctx.fillText(subtitle, margin, 72, contentWidth);
    for (const section of pages[page]) {
      ctx.fillStyle = '#21152e';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(section.title, margin, section.y + 17, contentWidth);
      if (section.note) {
        ctx.font = '11px sans-serif';
        ctx.fillText(section.note, margin, section.y + 34, contentWidth);
      }
      if (!section.rows.length) continue;
      const unit = contentWidth / section.weights.reduce((total, weight) => total + weight, 0);
      [section.headers, ...section.rows].forEach((row, index) => {
        const top = section.y + section.headingHeight + index * rowHeight;
        ctx.fillStyle = index === 0 ? '#302040' : index % 2 ? '#f2eef6' : '#ffffff';
        ctx.fillRect(margin, top, contentWidth, rowHeight);
        ctx.fillStyle = index === 0 ? '#ffffff' : '#21152e';
        ctx.font = index === 0 ? 'bold 11px sans-serif' : '12px sans-serif';
        let x = margin;
        row.forEach((value, column) => {
          const width = section.weights[column] * unit;
          ctx.fillText(value ?? '—', x + 7, top + 15, width - 14);
          x += width;
        });
      });
    }
    ctx.fillStyle = '#51465b';
    ctx.font = '10px sans-serif';
    ctx.fillText(`Seite ${page + 1} / ${pages.length}`, margin, 814);
  });
}
