import { useNavigate } from "react-router-dom";
import { goBackOrFallback } from "../utils/backNavigation";
import "../stylesheets/PageBack.css";

type Props = {
    label?: string;
    to?: string;
    preferTarget?: boolean;
};

export default function PageBack({ label = "Back", to, preferTarget = false }: Props) {
    const navigate = useNavigate();

    const handleBack = () => {
        if (preferTarget && to) {
            navigate(to);
            return;
        }
        goBackOrFallback(navigate, to ?? "/dashboard");
    };

    return (
        <button type="button" className="pageBack" onClick={handleBack} aria-label="Go back">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>{label}</span>
        </button>
    );
}
