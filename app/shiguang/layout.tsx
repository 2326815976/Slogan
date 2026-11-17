import SpaceContext from './components/SpaceContext';
import './shiguang.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SpaceContext>{children}</SpaceContext>;
}
