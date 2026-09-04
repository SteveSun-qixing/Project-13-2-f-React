import React from "react";

const appIconUrl = new URL("../../assets/icons/app-icon.svg", import.meta.url).href;

export function AppBrandIcon(props: React.ImgHTMLAttributes<HTMLImageElement>): React.ReactElement {
  const { alt = "", draggable = false, ...rest } = props;
  return <img src={appIconUrl} alt={alt} draggable={draggable} {...rest} />;
}
