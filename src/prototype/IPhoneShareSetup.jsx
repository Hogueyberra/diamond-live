import { useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Copy, DeviceMobile, X } from "@phosphor-icons/react";
import { capturePrefix } from "./shareCapture.js";
import "./share-capture.css";

export default function IPhoneShareSetup() {
  const dialog = useRef(null);
  const [notice, setNotice] = useState("");
  const prototypeUrl = new URL(`${import.meta.env.BASE_URL}prototype`, window.location.origin);
  const prefix = capturePrefix(prototypeUrl.href);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(prototypeUrl.hostname);
  async function copy() {
    try {
      await navigator.clipboard.writeText(prefix);
      setNotice("Address copied.");
    } catch {
      setNotice("Select and copy the address below.");
    }
  }
  return (
    <>
      <button className="lv-secondary" onClick={() => dialog.current.showModal()}>
        <DeviceMobile size={17} /> iPhone sharing
      </button>
      <dialog ref={dialog} className="lv-dialog sc-setup" aria-labelledby="sc-setup-title">
        <div className="pcl-detail-heading">
          <span className="pcl-eyebrow">ONE-TIME SHORTCUT SETUP</span>
          <button aria-label="Close iPhone setup" onClick={() => dialog.current.close()}>
            <X size={20} />
          </button>
        </div>
        <h2 id="sc-setup-title">A shorter path from video to practice.</h2>
        <p>
          In YouTube or Instagram, open the iPhone Share menu, choose{" "}
          <strong>Save to Diamond Live</strong>, then tap <strong>Save to Drill Inbox</strong>.
        </p>
        {local && (
          <div className="sc-warning">
            <strong>This is a computer-only preview address.</strong>
            <p>
              Open the published version on your iPhone before setting up the Shortcut. “localhost”
              on your phone points to the phone itself.
            </p>
          </div>
        )}
        <ol className="sc-setup-steps">
          <li>
            <strong>Create the Shortcut</strong>
            <p>
              In Apple Shortcuts, create a shortcut named <b>Save to Diamond Live</b>. In its
              details, enable <b>Show in Share Sheet</b>. Accept URLs and Text.
            </p>
          </li>
          <li>
            <strong>Pick the shared link</strong>
            <p>
              Add <b>Get URLs from Input</b>, using <b>Shortcut Input</b>. Then add{" "}
              <b>Get Item from List</b>, set to <b>First Item</b>. Share one video at a time.
            </p>
          </li>
          <li>
            <strong>Build the destination</strong>
            <p>
              Add a <b>Text</b> action. Paste this address and insert the <b>First Item</b> variable
              immediately after the #, with no space or newline.
            </p>
            <label>
              Capture address
              <input readOnly value={prefix} onFocus={(event) => event.target.select()} />
            </label>
            <button className="lv-secondary" onClick={copy}>
              <Copy size={16} /> Copy address
            </button>
            <p className="sc-storage">
              The # keeps the shared link in the browser instead of sending it to the website host.
            </p>
          </li>
          <li>
            <strong>Open and save</strong>
            <p>
              Add <b>Open URLs</b>, using the Text action’s output. On the first run, allow
              Shortcuts to open the page. Check the link and tap Save.
            </p>
          </li>
        </ol>
        <p className="sc-storage">
          This version opens a browser confirmation. It saves on that browser only. Use the same
          browser to return to your Inbox; team syncing and background capture are not connected
          yet.
        </p>
        <p role="status">{notice}</p>
        <div className="lv-detail-actions">
          <Link
            className="lv-primary"
            to="/prototype?capture=1"
            onClick={() => dialog.current.close()}
          >
            Try the capture screen <ArrowUpRight size={16} />
          </Link>
          <a
            className="pcl-source"
            href="https://support.apple.com/guide/shortcuts/run-a-shortcut-from-another-app-apd163eb9f95/ios"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple’s Share Sheet setup <ArrowUpRight size={16} />
          </a>
        </div>
      </dialog>
    </>
  );
}
