import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export function useRecurso(caminho) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const versao = useRef(0);
  const recarregar = useCallback(async () => {
    const atual = ++versao.current;
    setErro('');
    setCarregando(true);
    try {
      const resultado = await api(caminho);
      if (atual === versao.current) setDados(resultado);
      return resultado;
    } catch (e) {
      if (atual === versao.current) setErro(e.message);
    } finally {
      if (atual === versao.current) setCarregando(false);
    }
  }, [caminho]);
  useEffect(() => {
    recarregar();
    return () => {
      versao.current++;
    };
  }, [recarregar]);
  return { dados, setDados, erro, carregando, recarregar };
}
