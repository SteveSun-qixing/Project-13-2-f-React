import React from "react";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";

interface SearchFieldProps {
  value: string;
  placeholder: string;
  ariaLabel?: string;
  onChange: (value: string) => void;
}

export function SearchField({ value, placeholder, ariaLabel, onChange }: SearchFieldProps): React.ReactElement {
  return (
    <div className="search-field">
      <Input
        className="search-field__input"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        prefix={<SearchOutlined />}
        allowClear
        variant="filled"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
