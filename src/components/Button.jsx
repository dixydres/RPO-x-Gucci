export default function Button(props) {
  const { children, className } = props;
  return <button className={className}>{children}</button>;
}
