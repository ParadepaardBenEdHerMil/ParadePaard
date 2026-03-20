import React from "react";
import "../../stylesheets/common/Card.css";

export default function Card(props: {
  title: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className={`uiCard ${props.className ?? ""}`}>
      <div className="uiCardHeader">
        <h2 className="uiCardTitle">{props.title}</h2>
        <div className="uiCardRight">{props.right}</div>
      </div>

      <div className="uiCardBody">{props.children}</div>
    </section>
  );
}
