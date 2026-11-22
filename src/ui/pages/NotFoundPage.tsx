import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';

export function NotFoundPage() {
  return (
    <Layout title="Página não encontrada">
      <p>Este endereço não existe ou o evento foi apagado deste dispositivo.</p>
      <Link className="btn btn-primary" to="/">
        Ir para o início
      </Link>
    </Layout>
  );
}
