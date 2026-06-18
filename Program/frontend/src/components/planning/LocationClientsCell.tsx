import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { PlanningClientCompanyDTO } from "../../services/user-service/UserServices";

type LocationClientsCellProps = {
    clientIds: string[];
    clients: PlanningClientCompanyDTO[];
};

const SCROLL_THRESHOLD = 10;
const POPOVER_WIDTH = 240;

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
            className={`planningLocationsClientsChevron${
                open ? " planningLocationsClientsChevron--open" : ""
            }`}
        >
            <path
                d="M4 6l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function LocationClientsCell({ clientIds, clients }: LocationClientsCellProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const toggleRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const matched = useMemo(() => {
        return clientIds
            .map((id) => clients.find((client) => client.clientCompanyId === id))
            .filter((client): client is PlanningClientCompanyDTO => Boolean(client))
            .slice()
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }, [clientIds, clients]);

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return matched;
        return matched.filter((client) => (client.name ?? "").toLowerCase().includes(term));
    }, [matched, search]);

    const updatePosition = useCallback(() => {
        const toggle = toggleRef.current;
        if (!toggle) return;
        const rect = toggle.getBoundingClientRect();
        const margin = 8;
        const desiredLeft = rect.left;
        const maxLeft = window.innerWidth - POPOVER_WIDTH - margin;
        const left = Math.max(margin, Math.min(desiredLeft, maxLeft));
        setPosition({ top: rect.bottom + 4, left });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        updatePosition();
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;
        const handleReposition = () => updatePosition();
        window.addEventListener("resize", handleReposition);
        window.addEventListener("scroll", handleReposition, true);
        return () => {
            window.removeEventListener("resize", handleReposition);
            window.removeEventListener("scroll", handleReposition, true);
        };
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;
        const handleClick = (event: globalThis.MouseEvent) => {
            const target = event.target as Node;
            if (popoverRef.current?.contains(target)) return;
            if (toggleRef.current?.contains(target)) return;
            setOpen(false);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    useEffect(() => {
        if (!open) setSearch("");
    }, [open]);

    if (matched.length === 0) {
        return (
            <div className="planningLocationsCell planningLocationsCell--clients planningLocationsCell--muted">
                <span className="planningLocationsCellLine">No clients</span>
            </div>
        );
    }

    const stop = (event: MouseEvent) => event.stopPropagation();
    const scrollable = matched.length > SCROLL_THRESHOLD;

    return (
        <div className="planningLocationsCell planningLocationsCell--clients">
            <button
                type="button"
                ref={toggleRef}
                className="planningLocationsClientsToggle"
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((value) => !value);
                }}
                aria-expanded={open}
            >
                <span>
                    {matched.length} client{matched.length === 1 ? "" : "s"}
                </span>
                <ChevronIcon open={open} />
            </button>
            {open && position
                ? createPortal(
                      <div
                          ref={popoverRef}
                          className="planningLocationsClientsPopover"
                          role="dialog"
                          aria-label="Clients using this location"
                          style={{
                              top: position.top,
                              left: position.left,
                              width: POPOVER_WIDTH,
                          }}
                          onClick={stop}
                          onMouseDown={stop}
                      >
                          {scrollable ? (
                              <input
                                  type="search"
                                  className="planningLocationsClientsSearch"
                                  value={search}
                                  onChange={(event) => setSearch(event.target.value)}
                                  placeholder="search client"
                                  aria-label="Search client"
                              />
                          ) : null}
                          <ul
                              className={`planningLocationsClientsList${
                                  scrollable ? " planningLocationsClientsList--scroll" : ""
                              }`}
                          >
                              {visible.length === 0 ? (
                                  <li className="planningLocationsClientsEmpty">
                                      No clients match.
                                  </li>
                              ) : (
                                  visible.map((client) => (
                                      <li key={client.clientCompanyId}>
                                          <Link
                                              to={`/management/clients/${client.clientCompanyId}`}
                                              className="planningLocationsClientsLink"
                                              onClick={stop}
                                          >
                                              {client.name}
                                          </Link>
                                      </li>
                                  ))
                              )}
                          </ul>
                      </div>,
                      document.body
                  )
                : null}
        </div>
    );
}
