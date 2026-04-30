import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/** Saves code and redirects so WhatsApp links stay short: /r/CODE → welcome */
export default function ReferCaptureRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const trimmed = code?.trim();
    if (trimmed) {
      try {
        localStorage.setItem('clicks_ref_code', trimmed);
      } catch {
        /* ignore */
      }
    }
    navigate('/welcome', { replace: true });
  }, [code, navigate]);

  return null;
}
