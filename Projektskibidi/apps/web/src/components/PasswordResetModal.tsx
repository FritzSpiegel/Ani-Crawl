import React, { useState } from 'react';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [formData, setFormData] = useState({
    email: '',
    code: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset code');
      }

      setSuccess('Reset-Code wurde an Ihre E-Mail-Adresse gesendet!');
      setStep('reset');
      
    } catch (error: any) {
      console.error('Request reset error:', error);
      setError(error.message || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          code: formData.code,
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess('Passwort wurde erfolgreich zurückgesetzt! Sie können sich jetzt anmelden.');
      setTimeout(() => {
        onClose();
        setStep('request');
        setFormData({ email: '', code: '', newPassword: '', confirmPassword: '' });
      }, 2000);
      
    } catch (error: any) {
      console.error('Reset password error:', error);
      setError(error.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleClose = () => {
    onClose();
    setStep('request');
    setFormData({ email: '', code: '', newPassword: '', confirmPassword: '' });
    setError('');
    setSuccess('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#2a2a2a',
        padding: '30px',
        borderRadius: '10px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '2px solid #007bff'
      }}>
        <div className="modal-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ color: '#007bff', margin: 0 }}>
            {step === 'request' ? '🔑 Passwort zurücksetzen' : '🔄 Neues Passwort'}
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            ×
          </button>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleRequestReset}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                color: '#fff', 
                marginBottom: '5px',
                fontWeight: 'bold'
              }}>
                E-Mail-Adresse:
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  backgroundColor: '#333',
                  color: '#fff',
                  fontSize: '16px'
                }}
                placeholder="Ihre E-Mail-Adresse"
              />
            </div>

            <div className="info-section" style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '15px',
              borderRadius: '5px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <p style={{ margin: 0 }}>
                Wir senden Ihnen einen 6-stelligen Code an Ihre E-Mail-Adresse, 
                mit dem Sie Ihr Passwort zurücksetzen können.
              </p>
            </div>

            {error && (
              <div className="error-message" style={{
                backgroundColor: '#ff4444',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '15px'
              }}>
                {error}
              </div>
            )}

            {success && (
              <div className="success-message" style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '15px'
              }}>
                {success}
              </div>
            )}

            <div className="modal-actions" style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: '10px 20px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  backgroundColor: '#555',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: '#fff',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  opacity: isLoading ? 0.7 : 1
                }}
              >
                {isLoading ? 'Sende...' : 'Code senden'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                color: '#fff', 
                marginBottom: '5px',
                fontWeight: 'bold'
              }}>
                E-Mail-Adresse:
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                readOnly
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  backgroundColor: '#444',
                  color: '#ccc',
                  fontSize: '16px'
                }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                color: '#fff', 
                marginBottom: '5px',
                fontWeight: 'bold'
              }}>
                Reset-Code:
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  backgroundColor: '#333',
                  color: '#fff',
                  fontSize: '16px',
                  letterSpacing: '2px',
                  textAlign: 'center'
                }}
                placeholder="XXXXXX"
                maxLength={6}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                color: '#fff', 
                marginBottom: '5px',
                fontWeight: 'bold'
              }}>
                Neues Passwort:
              </label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  backgroundColor: '#333',
                  color: '#fff',
                  fontSize: '16px'
                }}
                placeholder="Mindestens 6 Zeichen"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                color: '#fff', 
                marginBottom: '5px',
                fontWeight: 'bold'
              }}>
                Passwort bestätigen:
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  backgroundColor: '#333',
                  color: '#fff',
                  fontSize: '16px'
                }}
                placeholder="Passwort wiederholen"
              />
            </div>

            {error && (
              <div className="error-message" style={{
                backgroundColor: '#ff4444',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '15px'
              }}>
                {error}
              </div>
            )}

            {success && (
              <div className="success-message" style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '15px'
              }}>
                {success}
              </div>
            )}

            <div className="modal-actions" style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setStep('request')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '5px',
                  border: '1px solid #555',
                  backgroundColor: '#555',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Zurück
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#28a745',
                  color: '#fff',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  opacity: isLoading ? 0.7 : 1
                }}
              >
                {isLoading ? 'Setze zurück...' : 'Passwort zurücksetzen'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PasswordResetModal;
