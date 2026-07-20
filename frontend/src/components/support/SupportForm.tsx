import React, { useState } from 'react';

export const SupportForm = () => {
  const [ticket, setTicket] = useState({ subject: '', message: '', priority: 1 });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Gönderilen talep:", ticket);
    // İleride buraya backend'e gönderecek fetch komutunu ekleyeceğiz
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc' }}>
      <h3>Destek Talebi Oluştur</h3>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Konu"
          value={ticket.subject}
          onChange={(e) => setTicket({ ...ticket, subject: e.target.value })}
        /><br />
        <textarea
          placeholder="Mesajınız"
          value={ticket.message}
          onChange={(e) => setTicket({ ...ticket, message: e.target.value })}
        /><br />

        <label>Aciliyet Durumu: </label>
        <select
          value={ticket.priority}
          onChange={(e) => setTicket({ ...ticket, priority: Number(e.target.value) })}
        >
          <option value={1}>Az Acil</option>
          <option value={2}>Orta Acil</option>
          <option value={3}>Çok Acil</option>
        </select><br /><br />

        <button type="submit">Gönder</button>
      </form>
    </div>
  );
};