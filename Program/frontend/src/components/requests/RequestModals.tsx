// src/components/requests/RequestModals.tsx
import React, { useState } from "react";
import Modal from "../common/Modal";
import { formatMaybeDateTime } from "../../utils/dateFormat";

export type BaseRequest = {
    id: string;
    by: string;
    createdAt: string;
    userId?: string;
};

export type LeaveRequest = BaseRequest & {
    type: "Leave";
    fromDate: string;
    toDate: string;
    hoursRequested: number;
    hoursAvailable: number;
    note?: string;
};

export type PayslipUpdateRequest = BaseRequest & {
    type: "PayslipUpdate";
    period: string;
    fieldsToFix: string[];
    note?: string;
};

export type NewMemberRequest = BaseRequest & {
    type: "NewMember";
    candidateName: string;
    role: string;
    startDate: string;
    manager: string;
    note?: string;
};

export type AnyRequest = LeaveRequest | PayslipUpdateRequest | NewMemberRequest;

export function AdminLeaveRequestModal({
                                           open,
                                           onClose,
                                           data,
                                           onApprove,
                                           onReject,
                                       }: {
    open: boolean;
    onClose: () => void;
    data: LeaveRequest;
    onApprove: (id: string) => void;
    onReject: (id: string, reason?: string) => void;
}) {
    const [reason, setReason] = useState("");

    const remaining = data.hoursAvailable - data.hoursRequested;

    return (
        <Modal open={open} onClose={onClose} title="Leave request">
            <div className="grid_two">
                <Info label="From" value={data.by} />
                <Info label="Requested on" value={data.createdAt} />
                <Info label="Leave start" value={data.fromDate} />
                <Info label="Leave end" value={data.toDate} />
                <Info label="Hours requested" value={data.hoursRequested} />
                <Info label="Hours available now" value={data.hoursAvailable} />
                <Info
                    label="Hours left if approved"
                    value={remaining}
                    valueClass={remaining < 0 ? "text_bad" : "text_ok"}
                />
            </div>

            {data.note && (
                <div className="section_block">
                    <h4 className="section_title">Note</h4>
                    <p className="section_text">{data.note}</p>
                </div>
            )}

            <div className="form_row form_row_full">
                <label className="form_label">Decision note</label>
                <textarea
                    rows={3}
                    className="modal_input"
                    placeholder="Optional"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
            </div>

            <div className="actions_row">
                <button className="btn primary" onClick={() => onApprove(data.id)}>Approve</button>
                <button className="btn danger" onClick={() => onReject(data.id, reason || undefined)}>Reject</button>
            </div>
        </Modal>
    );
}

export function PayslipUpdateRequestModal({
                                              open,
                                              onClose,
                                              data,
                                              onMarkFixed,
                                              onAskInfo,
                                          }: {
    open: boolean;
    onClose: () => void;
    data: PayslipUpdateRequest;
    onMarkFixed: () => void;
    onAskInfo: () => void;
}) {
    return (
        <Modal open={open} onClose={onClose} title="Payslip update request">
            <div className="grid_two">
                <Info label="From" value={data.by} />
                <Info label="Requested on" value={data.createdAt} />
                <Info label="Pay period" value={data.period} />
            </div>

            <div className="section_block">
                <h4 className="section_title">Fields to fix</h4>
                <ul className="bullet_list">
                    {data.fieldsToFix.map((f) => (
                        <li key={f}>{f}</li>
                    ))}
                </ul>
            </div>

            {data.note && (
                <div className="section_block">
                    <h4 className="section_title">Note</h4>
                    <p className="section_text">{data.note}</p>
                </div>
            )}

            <div className="actions_row">
                <button className="btn primary" onClick={onMarkFixed}>Mark fixed</button>
                <button className="btn" onClick={onAskInfo}>Ask for more info</button>
            </div>
        </Modal>
    );
}

export function NewMemberRequestModal({
                                          open,
                                          onClose,
                                          data,
                                          onApprove,
                                          onReject,
                                      }: {
    open: boolean;
    onClose: () => void;
    data: NewMemberRequest;
    onApprove: () => void;
    onReject: () => void;
}) {
    return (
        <Modal open={open} onClose={onClose} title="New member request">
            <div className="grid_two">
                <Info label="From" value={data.by} />
                <Info label="Requested on" value={data.createdAt} />
                <Info label="Candidate" value={data.candidateName} />
                <Info label="Planned role" value={data.role} />
                <Info label="Start date" value={data.startDate} />
                <Info label="Manager" value={data.manager} />
            </div>

            {data.note && (
                <div className="section_block">
                    <h4 className="section_title">Note</h4>
                    <p className="section_text">{data.note}</p>
                </div>
            )}

            <div className="actions_row">
                <button className="btn primary" onClick={onApprove}>Approve</button>
                <button className="btn danger" onClick={onReject}>Reject</button>
            </div>
        </Modal>
    );
}

function Info({
                  label,
                  value,
                  valueClass,
              }: {
    label: string;
    value: React.ReactNode;
    valueClass?: string;
}) {
    const displayValue =
        typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
            ? formatMaybeDateTime(value)
            : value;
    return (
        <div className="info_item">
            <div className="info_label">{label}</div>
            <div className={`info_value ${valueClass || ""}`.trim()}>{displayValue}</div>
        </div>
    );
}
