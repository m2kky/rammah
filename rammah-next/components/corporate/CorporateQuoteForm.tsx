"use client";

import { useState } from "react";
import styles from "./CorporateExperience.module.css";

export default function CorporateQuoteForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");

    // Simulate API call
    setTimeout(() => {
      setStatus("success");
    }, 1500);
  };

  if (status === "success") {
    return (
      <div className={styles.formContainer} style={{ textAlign: "center", padding: "60px 30px" }}>
        <h3 className="text-2xl font-bold mb-4 text-[#0F3B46]">Request Received</h3>
        <p className="text-[#02040A]/70">
          Thank you for reaching out. Our team will review your requirements and get back to you within 24-48 hours.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      <h3 className="text-2xl font-bold mb-6 text-[#0F3B46]">Request a Corporate Quote</h3>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="company">Company Name</label>
          <input type="text" id="company" name="company" required placeholder="e.g. Acme Corp" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={styles.formGroup}>
            <label htmlFor="name">Contact Name</label>
            <input type="text" id="name" name="name" required placeholder="Jane Doe" />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">Work Email</label>
            <input type="email" id="email" name="email" required placeholder="jane@acme.com" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={styles.formGroup}>
            <label htmlFor="teamSize">Team Size</label>
            <select id="teamSize" name="teamSize" required>
              <option value="">Select size...</option>
              <option value="1-10">1-10 people</option>
              <option value="11-50">11-50 people</option>
              <option value="51-200">51-200 people</option>
              <option value="200+">200+ people</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="timeline">Expected Timeline</label>
            <select id="timeline" name="timeline" required>
              <option value="">Select timeline...</option>
              <option value="ASAP">As soon as possible</option>
              <option value="1-3 months">1-3 months</option>
              <option value="3-6 months">3-6 months</option>
              <option value="Planning phase">Just planning</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="goals">Key Objectives</label>
          <textarea 
            id="goals" 
            name="goals" 
            required 
            placeholder="What behavior or performance gaps are you trying to address in your team?"
          ></textarea>
        </div>

        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Submitting..." : "Request Quote"}
        </button>
      </form>
    </div>
  );
}
