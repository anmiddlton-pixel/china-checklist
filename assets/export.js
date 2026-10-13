/* Marks are drawn onto the original PDF; no personal data leaves the browser. */
const CHECKLIST_POSITIONS = {"a1": {"page": 0, "x": 43.4, "y": 568.57}, "a2": {"page": 0, "x": 43.4, "y": 533.97}, "a3": {"page": 0, "x": 43.4, "y": 514.274}, "a4": {"page": 0, "x": 43.4, "y": 479.674}, "a5": {"page": 0, "x": 43.4, "y": 459.978}, "b1": {"page": 0, "x": 43.4, "y": 371.562}, "b2": {"page": 0, "x": 43.4, "y": 325.058}, "b3": {"page": 0, "x": 43.4, "y": 290.45799999999997}, "b4": {"page": 0, "x": 43.4, "y": 255.85800000000006}, "c1": {"page": 1, "x": 43.4, "y": 566.154}, "c2": {"page": 1, "x": 43.4, "y": 546.458}, "c3": {"page": 1, "x": 43.4, "y": 511.858}, "c4": {"page": 1, "x": 43.4, "y": 477.258}, "d1": {"page": 1, "x": 43.4, "y": 339.618}, "d2": {"page": 1, "x": 43.4, "y": 319.922}, "d3": {"page": 1, "x": 43.4, "y": 285.322}, "d4": {"page": 1, "x": 43.4, "y": 265.626}, "d5": {"page": 1, "x": 43.4, "y": 245.92999999999995}, "d6": {"page": 1, "x": 43.4, "y": 226.23400000000004}, "e1": {"page": 2, "x": 43.4, "y": 588.57}, "e2": {"page": 2, "x": 43.4, "y": 553.97}, "e3": {"page": 2, "x": 43.4, "y": 519.37}, "e4": {"page": 2, "x": 43.4, "y": 484.77}, "e5": {"page": 2, "x": 43.4, "y": 450.17}, "e6": {"page": 2, "x": 43.4, "y": 430.474}, "e7": {"page": 2, "x": 43.4, "y": 410.778}, "f1": {"page": 2, "x": 43.4, "y": 322.36199999999997}, "f2": {"page": 2, "x": 43.4, "y": 287.76200000000006}, "g1": {"page": 3, "x": 43.4, "y": 588.57}, "g2": {"page": 3, "x": 43.4, "y": 553.97}, "g3": {"page": 3, "x": 43.4, "y": 519.37}, "g4": {"page": 3, "x": 43.4, "y": 484.77}, "g5": {"page": 3, "x": 43.4, "y": 450.17}, "g6": {"page": 3, "x": 43.4, "y": 430.474}, "g8": {"page": 3, "x": 43.4, "y": 410.778}, "h1": {"page": 4, "x": 43.4, "y": 588.57}, "h2": {"page": 4, "x": 43.4, "y": 553.97}, "h3": {"page": 4, "x": 43.4, "y": 519.37}, "h4": {"page": 4, "x": 43.4, "y": 499.674}, "h5": {"page": 4, "x": 43.4, "y": 465.074}, "h7": {"page": 4, "x": 43.4, "y": 430.474}, "i1": {"page": 4, "x": 43.4, "y": 319.64199999999994}, "i2": {"page": 4, "x": 43.4, "y": 285.04200000000003}, "i3": {"page": 4, "x": 43.4, "y": 250.442}, "i4": {"page": 4, "x": 43.4, "y": 230.74599999999998}};
async function createChecklistPdf(template, selected) {
  const pdf = await PDFLib.PDFDocument.load(template);
  // Flatten empty widgets before drawing: Apple PDFKit otherwise overlays /Off appearances.
  // The template already paints checkbox outlines in page content.
  // Drop the duplicate interactive widgets and the form tree.
  for (const page of pdf.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    const links = annotations.asArray().filter(ref => {
      const item = pdf.context.lookup(ref);
      return item.get(PDFLib.PDFName.of('Subtype'))?.toString() !== '/Widget';
    });
    page.node.set(PDFLib.PDFName.of('Annots'), pdf.context.obj(links));
  }
  pdf.catalog.delete(PDFLib.PDFName.of('AcroForm'));
  const pages = pdf.getPages();
  pdf.setTitle('Checklist — ' + selected.length + ' / 45 — ' + new Date().toISOString());
  const form = pdf.getForm();
  const checked = new Set(selected);
  for (const [id, point] of Object.entries(CHECKLIST_POSITIONS)) {
    const {page, x, y} = point;
    const field = form.createCheckBox(id);
    field.addToPage(pages[page], {
      x: x - 2, y: y - 2, width: 14, height: 14,
      borderWidth: 0.8, borderColor: PDFLib.rgb(0.12, 0.34, 0.27),
      backgroundColor: PDFLib.rgb(1, 1, 1),
      textColor: PDFLib.rgb(0.12, 0.34, 0.27),
    });
    if (checked.has(id)) field.check();
    else field.uncheck();
  }
  form.updateFieldAppearances();
  // Use single-dictionary checkbox fields: the form and page reference
  // the same widget, with explicit editable flags and saved appearances.
  const fieldRefs = [];
  for (const field of form.getFields()) {
    const fieldDict = field.acroField.dict;
    const kids = fieldDict.lookup(PDFLib.PDFName.of('Kids'), PDFLib.PDFArray);
    const widgetRef = kids.get(0);
    const widget = pdf.context.lookup(widgetRef);
    for (const name of ['FT', 'T', 'V', 'DA']) {
      const value = fieldDict.get(PDFLib.PDFName.of(name));
      if (value) widget.set(PDFLib.PDFName.of(name), value);
    }
    widget.set(PDFLib.PDFName.of('Ff'), PDFLib.PDFNumber.of(0));
    widget.delete(PDFLib.PDFName.of('Parent'));
    fieldRefs.push(widgetRef);
  }
  form.acroForm.dict.set(PDFLib.PDFName.of('Fields'), pdf.context.obj(fieldRefs));
  form.acroForm.dict.set(PDFLib.PDFName.of('NeedAppearances'), PDFLib.PDFBool.False);
  return await pdf.save({updateFieldAppearances: false, useObjectStreams: false});
}
