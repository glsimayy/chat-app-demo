import React from "react";

interface AddButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}
const AddButton = ({ onClick, ariaLabel }: AddButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="btn btn-soft-primary btn-sm"
    >
      <i className="bx bx-plus"></i>
    </button>
  );
};

export default AddButton;
