# iPhone capture prototype

Built October 20, 2026. `/prototype` now includes a link-only capture screen and an unsorted Drill Inbox. This change does not install a Shortcut on a phone, publish the branch, or connect the prototype library to account storage.

## Intended daily flow

1. Share a YouTube video, Instagram post, or other link.
2. Choose **Save to Diamond Live** in the iPhone Share Sheet (sometimes under More).
3. The browser opens with the source filled in. Tap **Save to Drill Inbox**.

No title, skill, creator, or notes are required at capture time. Later, open Library → Video links → Inbox and organize the link. Selecting a companion skill enables the existing lesson guide and coach-review workflow.

[Apple documents running Shortcuts from another app's Share Sheet.](https://support.apple.com/guide/shortcuts/run-a-shortcut-from-another-app-apd163eb9f95/ios)

## One-time Shortcut setup

Use a published HTTPS version of this branch on an actual iPhone. A computer's `localhost` address does not reach that computer from the phone. The in-app guide identifies localhost preview addresses.

In Apple Shortcuts:

1. Create **Save to Diamond Live**. Enable **Show in Share Sheet** and accept **URLs** and **Text**.
2. Add **Get URLs from Input**, taking **Shortcut Input**.
3. Add **Get Item from List**, choosing **First Item**. Share one source at a time.
4. Add **Text**. Paste the capture address copied from Library → Video links → iPhone sharing. Insert the **First Item** variable immediately after the trailing `#`, without a space or newline.
5. Add **Open URLs**, taking that Text action's output.
6. Test a real shared link and allow the initial open-page permission if prompted. Verify the displayed source before saving.

The address includes the deployment base path:

```
https://diamondliveapp.com/prototype?capture=1#https://www.youtube.com/watch?v=VIDEO_ID
```

The source travels in the fragment, preserving its query parameters without a separate URL-encoding action. The client reads the fragment; it is not sent to the static website host. Opening the URL alone does not save anything. The visible confirmation button performs the local write.

## Implemented behavior

- Accepts raw URL fragments, URL-encoded fragments, and `url`/`text` query fallbacks.
- HTTPS validation rejects executable schemes and embedded credentials. Ambiguous text with multiple URLs is rejected.
- Captures enter the existing isolated browser store with an empty `drillId` and `reviewed: false`.
- Duplicate canonical URLs preserve existing titles, notes, skills, and reviews. Organized duplicates open the full video library; new captures open Inbox.
- Opening and closing capture retains mounted practice drafts and development proposals.
- Tabs receive local-storage events. Edits reload the latest saved collection before writing to reduce stale-tab overwrites. Local storage is not a transactional multi-user backend.
- Blocked-storage confirmations explicitly state that the capture is session-only and will not survive reload.
- Leaving capture clears the source fragment from the URL.

## Remaining before real phone use

- The release workflow publishes the receiver at `https://diamondliveapp.com/prototype?capture=1`. Verify the deployed version before installing the Shortcut.
- Create/install the Shortcut on the user's iPhone and test the actual YouTube and Instagram share payloads. These instructions are a setup recipe; no signed `.shortcut` file or iCloud installation URL is claimed.
- Add authenticated shared library persistence for phone-to-computer and team access. Current saves stay in the browser/origin where capture opened; they do not sync to the existing account backend.
- Background saving without opening the browser would require a separate authenticated API workflow. This version presents a short browser confirmation.

## Browser evidence

Responsive captures in `iphone-capture-qa/` show capture and saved states at 390 × 844. These are desktop browser checks, not a physical iPhone validation. A temporary `example.org/iphone-capture-qa` record was used solely for inspection and removed afterward.

The setup dialog was also inspected at 390 × 844 (`03-setup.png`). The browser was restored to its normal viewport after inspection.

## Validation

- All seven focused tests in `src/prototype/shareCapture.test.jsx` passed, covering input parsing, unsafe input, Inbox capture, duplicate preservation, draft retention, unavailable storage, and changes from another tab.
- The production build passed. It retains the existing warning about the main application bundle exceeding 500 kB.
- `git diff --check` passed.
- A combined test run encountered a worker startup timeout; a retry using a fork worker stalled and was stopped. The focused capture suite completed successfully with one thread worker. No physical iPhone test or production deployment is claimed.
