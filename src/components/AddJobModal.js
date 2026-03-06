import { useState, useRef } from "react";
import { Modal, Button, Form, Row, Col, Spinner, InputGroup } from "react-bootstrap";
import { formatDate, cleanJobUrl } from "../utils/dateFormat";
import { detectAts } from "../utils/atsDetect";
import { useApi } from "../hooks/useApi";

// Format a SQLite UTC datetime string ("YYYY-MM-DD HH:MM:SS") for display
const formatTimestamp = (utcStr) => {
  if (!utcStr) return "";
  const d = new Date(utcStr.replace(" ", "T") + "Z");
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
};

const today = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
};

const emptyForm = () => ({
  Date: today(),
  Role: "",
  Company: "",
  "Job Board Link": "",
  "Direct Company Job Link": "",
  ATS: "",
  Resume: false,
  "Cover Letter": false,
  Status: "Applied",
  Notes: "",
});

// Rendered with a `key` prop by the parent so it remounts fresh for each row.
export default function AddJobModal({ show, onHide, onAdd, onSave, initialData, dropdownOptions }) {
  const isEditing = !!initialData;

  const [form, setForm] = useState(() =>
    initialData ? { ...initialData } : emptyForm()
  );
  const [dateError, setDateError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeNote, setScrapeNote] = useState(null); // "ok" | "empty" | null
  const { request } = useApi();
  const datePickerRef = useRef(null);

  // Convert MM/DD/YYYY → YYYY-MM-DD for the hidden <input type="date">
  const dateForPicker = (() => {
    const parts = (form.Date || "").split("/");
    if (parts.length === 3 && parts[2].length === 4)
      return `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
    return "";
  })();

  const handleCalendarChange = (e) => {
    if (!e.target.value) return;
    const [year, month, day] = e.target.value.split("-");
    set("Date", `${month}/${day}/${year}`);
    setDateError(false);
  };

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleUrlPaste = (field) => (e) => {
    const pasted = e.clipboardData.getData("text");
    const cleaned = cleanJobUrl(pasted);
    if (cleaned !== pasted) {
      e.preventDefault();
      if (field === "Direct Company Job Link") {
        setForm(prev => ({ ...prev, "Direct Company Job Link": cleaned, ATS: detectAts(cleaned) || "" }));
      } else {
        set(field, cleaned);
      }
    }
  };

  const handleScrape = async () => {
    const url = form["Job Board Link"];
    if (!url) return;
    setScraping(true);
    setScrapeNote(null);
    try {
      const res = await request(`/api/scrape?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const { role, company } = await res.json();
        setForm(prev => ({
          ...prev,
          ...(role    ? { Role:    role    } : {}),
          ...(company ? { Company: company } : {}),
        }));
        setScrapeNote(role || company ? "ok" : "empty");
      } else {
        setScrapeNote("empty");
      }
    } catch (err) {
      console.error("[scrape] request failed:", err);
      setScrapeNote("empty");
    } finally {
      setScraping(false);
    }
  };

  const handleDateBlur = () => {
    if (!form.Date) { setDateError(false); return; }
    const formatted = formatDate(form.Date);
    if (formatted === null) {
      setDateError(true);
    } else {
      setDateError(false);
      set("Date", formatted);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dateError) return;
    if (!form.Role.trim() || !form.Company.trim()) return;

    let committed = form;
    if (form.Date) {
      const formatted = formatDate(form.Date);
      if (formatted === null) { setDateError(true); return; }
      committed = { ...form, Date: formatted };
    }

    setSubmitting(true);
    if (isEditing) {
      await onSave(committed);
    } else {
      await onAdd(committed);
      setForm(emptyForm());
      setDateError(false);
    }
    setSubmitting(false);
    onHide();
  };

  const handleHide = () => {
    if (!isEditing) {
      setForm(emptyForm());
      setDateError(false);
    }
    onHide();
  };

  const statusOptions = dropdownOptions["Status"] || [];
  const formStatus = form.Status || statusOptions[0] || "";

  return (
    <Modal show={show} onHide={handleHide} size="lg" aria-labelledby="add-job-modal-title" backdrop="static" keyboard={false}>
      <Modal.Header closeButton>
        <Modal.Title id="add-job-modal-title">{isEditing ? "Edit Job" : "Add Job"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Row className="mb-3">
            <Col sm={12}>
              <Form.Group>
                <Form.Label>Job Board Link</Form.Label>
                <InputGroup>
                  <Button
                    variant="outline-secondary"
                    onClick={handleScrape}
                    disabled={!form["Job Board Link"] || scraping}
                    title="Auto-detect role and company from this URL"
                    aria-label="Auto-detect role and company"
                    style={{ zIndex: 0 }}
                  >
                    {scraping
                      ? <Spinner animation="border" size="sm" />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    }
                  </Button>
                  <Form.Control
                    type="text"
                    placeholder="https://"
                    value={form["Job Board Link"]}
                    onChange={e => { set("Job Board Link", e.target.value); setScrapeNote(null); }}
                    onPaste={handleUrlPaste("Job Board Link")}
                    autoFocus={!isEditing}
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => window.open(form["Job Board Link"], "_blank", "noopener,noreferrer")}
                    disabled={!form["Job Board Link"]}
                    title="Open in new tab"
                    aria-label="Open job board link in new tab"
                    style={{ zIndex: 0 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </Button>
                </InputGroup>
                {!scrapeNote && (
                  <div className="text-muted small mt-1 text-center">Paste the URL from a job board site and click the search icon to auto-parse the job listing</div>
                )}
                {scrapeNote === "ok" && (
                  <div className="text-success small mt-1">✓ Role and company detected</div>
                )}
                {scrapeNote === "empty" && (
                  <div className="text-muted small mt-1">Could not detect job details — please fill in manually</div>
                )}
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col sm={4}>
              <Form.Group>
                <Form.Label>Date</Form.Label>
                <InputGroup>
                  {isEditing && (
                    <Button
                      variant="outline-secondary"
                      onClick={() => {
                        const el = datePickerRef.current;
                        if (!el) return;
                        try { el.showPicker(); } catch { el.click(); }
                      }}
                      title="Pick a date"
                      aria-label="Open date picker"
                      style={{ zIndex: 0 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </Button>
                  )}
                  <Form.Control
                    type="text"
                    placeholder="mm/dd/yyyy"
                    value={form.Date}
                    onChange={e => { set("Date", e.target.value); setDateError(false); }}
                    onBlur={handleDateBlur}
                    isInvalid={dateError}
                    aria-describedby={dateError ? "date-error" : undefined}
                    disabled={!isEditing}
                  />
                  <input
                    ref={datePickerRef}
                    type="date"
                    value={dateForPicker}
                    onChange={handleCalendarChange}
                    style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </InputGroup>
                {dateError && (
                  <Form.Control.Feedback type="invalid" id="date-error" style={{ display: "block" }}>
                    Enter a date like 2/3, 2/3/25, or 02/03/2025
                  </Form.Control.Feedback>
                )}
              </Form.Group>
            </Col>
            {isEditing && initialData?.updated_at && (
              <Col sm={8}>
                <Form.Group>
                  <Form.Label>
                    Last Updated
                    {initialData.updated_at !== initialData.created_at && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: "#1a73e8" }}>edited</span>
                    )}
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formatTimestamp(initialData.updated_at)}
                    readOnly
                    style={{ fontSize: 13 }}
                  />
                </Form.Group>
              </Col>
            )}
          </Row>

          <Row className="mb-3">
            <Col sm={8}>
              <Form.Group>
                <Form.Label>Company</Form.Label>
                <Form.Control
                  type="text"
                  value={form.Company}
                  onChange={e => set("Company", e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col sm={4}>
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={formStatus}
                  onChange={e => set("Status", e.target.value)}
                >
                  {statusOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col sm={8}>
              <Form.Group>
                <Form.Label>Role</Form.Label>
                <Form.Control
                  type="text"
                  value={form.Role}
                  onChange={e => set("Role", e.target.value)}
                  required
                />
              </Form.Group>
            </Col>
            <Col sm={4}>
              <Form.Group>
                <Form.Label>Direct Company Job Link</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="https://"
                    value={form["Direct Company Job Link"]}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(prev => ({ ...prev, "Direct Company Job Link": val, ATS: detectAts(val) || "" }));
                    }}
                    onPaste={handleUrlPaste("Direct Company Job Link")}
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => window.open(form["Direct Company Job Link"], "_blank", "noopener,noreferrer")}
                    disabled={!form["Direct Company Job Link"]}
                    title="Open in new tab"
                    aria-label="Open company job link in new tab"
                    style={{ zIndex: 0 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </Button>
                </InputGroup>
                {form["ATS"] && (
                  <div className="text-muted small mt-1">
                    Application portal: <strong>{form["ATS"]}</strong>
                  </div>
                )}
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3">
            <Col sm={6}>
              <Form.Group>
                <Form.Label className="d-block">Resume</Form.Label>
                <Form.Check
                  type="checkbox"
                  label="Sent resume"
                  checked={form.Resume}
                  onChange={e => set("Resume", e.target.checked)}
                />
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group>
                <Form.Label className="d-block">Cover Letter</Form.Label>
                <Form.Check
                  type="checkbox"
                  label="Sent cover letter"
                  checked={form["Cover Letter"]}
                  onChange={e => set("Cover Letter", e.target.checked)}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group>
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              value={form.Notes}
              onChange={e => set("Notes", e.target.value)}
              style={{ whiteSpace: "pre-wrap" }}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleHide} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || dateError || !form.Role.trim() || !form.Company.trim()}>
            {submitting ? "Saving…" : isEditing ? "Save Changes" : "Add Job"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
