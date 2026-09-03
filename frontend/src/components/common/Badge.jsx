import { getStatusColor } from '../../utils/formatters';

export function Badge({ status }) {
  return <span className={`badge ${getStatusColor(status)}`}>{status}</span>;
}
