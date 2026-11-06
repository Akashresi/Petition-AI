# PetitionAI - First-Time User Test Script (A11y Walkthrough)

**Target User:** A citizen with little or no formal education, operating an entry-level smartphone. Once learned once, the citizen should be able to navigate and submit petitions independently without external help.

---

## 6-Step Citizen Walkthrough

### Step 1: Choose Language
- **Action:** Open the app for the first time. A modal appears with 3 large buttons displaying each language in its native script:
  - **தமிழ்** (Tamil)
  - **हिन्दी** (Hindi)
  - **English** (English)
- **What the user sees:** Large buttons (minimum 56px height) with language icons. No English navigation or jargon required to make the selection. Selection is permanently remembered in `localStorage`.
- **Potential Confusion Point:** If an illiterate citizen does not recognize script letters, they might not know which button to tap.
  - *Mitigation:* Audio cue or native speaker icon + top-placed Tamil button (default primary focus). The citizen can tap "Change Language" (🌐) from the header on any screen at any time.

---

### Step 2: Report by Voice
- **Action:** On the citizen home screen, tap the large top button: **"Report a Problem" / "பிரச்சினையை பதிவு செய்க"**.
- **What happens:** The 4-step submission wizard opens at Step 1: *"What is the problem?"*.
- **Interaction:** The citizen taps the large animated **Microphone** button (`AccessibleVoiceInput`). They speak in Tamil, Hindi, or English.
  - Real-time transcription fills the text area in real-time.
  - A fallback typing area is always available if browser speech recognition is not supported or microphone permissions are blocked.
  - Tapping the microphone again stops listening.
- **Potential Confusion Point:** Browser microphone permission popup ("Allow PetitionAI to use your microphone?").
  - *Mitigation:* A clear banner displays "Tap Allow when browser asks for microphone permission". If blocked, the standard text box is never disabled so submission is never blocked.

---

### Step 3: Where is the Problem & Optional Photo
- **Action:** Tap "Next / அடுத்தது" to proceed to Step 2: *"Where?"*.
  - GPS auto-location button (`Auto-detect location`) fills coordinates with one click.
  - Optional simple landmark text box.
- **Step 3 (Optional Photo):**
  - "Take Photo or Upload". Marked clearly with camera icon and `(Optional)` tag.
  - One-tap "Next" if the citizen does not have a photo.
- **Potential Confusion Point:** GPS permission denied or inside building where GPS accuracy is low.
  - *Mitigation:* Landmark field with plain placeholder ("e.g. Near bus stop, temple, school"). GPS is optional and never blocks submission.

---

### Step 4: Check and Send
- **Action:** Step 4 shows a concise summary card:
  - Summary of problem description
  - Location
  - Attached photo thumbnail (if any)
- **Interaction:** Exactly **ONE primary button** on the screen: **"Send Complaint" / "மனுவை அனுப்புக"** (High-contrast slate/navy button, >= 48px height, paper plane icon).
- **Potential Confusion Point:** Fear of submitting incorrect information or accidental taps.
  - *Mitigation:* Clear "Back" button to return to previous steps. Large single primary action button with unambiguous wording.

---

### Step 5: Note Complaint ID
- **Action:** Upon sending, the confirmation screen appears (`ConfirmationCard`):
  - Large formatted Complaint ID digits (e.g., **`PET-2026-001`**) in extra-large mono font with copy icon.
  - "Read this aloud" button (TTS in selected language).
  - "Send me an SMS" button for non-smartphone or offline reference.
- **Potential Confusion Point:** Citizen forgets or cannot write down the complaint ID.
  - *Mitigation:* The citizen can retrieve and track their complaint later using their **10-digit mobile phone number** instead of the petition ID.

---

### Step 6: Track & Hear Status Read Aloud
- **Action:** From home screen, citizen taps **"Track My Complaint" / "மனுவின் நிலை அறிய"**.
- **Search:** Citizen enters either:
  1. The Petition ID (e.g. `PET-2026-001`), OR
  2. Their 10-digit mobile number.
- **Display:**
  - Vertical 4-stage timeline: **1. Received → 2. Checked → 3. With Officer → 4. Resolved** (Icon + single plain word per step).
  - Plain-language explanation: *"Your complaint is with the officer"*.
  - Plain-language Expected Resolution Date: *"Expected resolution: Monday, 9 Nov 2026"*.
  - **"Read Status Aloud"** speaker button reads the full status and date in Tamil (`ta-IN`), Hindi (`hi-IN`), or English.
- **Potential Confusion Point:** Technical terms like "SLA", "escalation", "assignedDepartment".
  - *Mitigation:* Plain-words mapping. Zero technical jargon on citizen screens.

---

## Accessibility Checklist Summary (WCAG 2.1 AA)

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Touch Targets** | $\ge 48\text{px} \times 48\text{px}$ on all buttons and inputs | Verified |
| **Typography Scale** | Base body $\ge 18\text{px}$, with A+ / A- scaling (up to 200%) | Verified |
| **Color Contrast** | Minimum 4.5:1 text-to-background contrast ratio | Verified |
| **Color Alone** | Every status uses Icon + Text Label + Color | Verified |
| **Screen Readers** | `aria-label`, `aria-live`, role attributes on all controls | Verified |
| **Cognitive Simplicity** | Max 1 primary button per screen, 4-step wizard with "Step X of 4" | Verified |
| **Multilingual** | Native scripts (தமிழ், हिन्दी, English), modular locales | Verified |
| **Voice / Speech** | Speech recognition for input, SpeechSynthesis for TTS | Verified |
