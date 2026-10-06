// O middleware já redireciona "/" para /login ou /precos antes de chegar
// aqui — este componente só existe para a rota ser válida em build/SSR.
export default function RootPage() {
  return null;
}
