'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './FloatingCTA.module.css';

export default function FloatingCTA() {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const [scrollDirection, setScrollDirection] = useState<'down' | 'up' | 'top'>('top');
    const lastScrollY = useRef(0);

    const isFocusedFlow = pathname?.startsWith('/booking');

    useEffect(() => {
        if (isFocusedFlow) return;

        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY < 100) {
                setScrollDirection('top');
            } else if (currentScrollY > lastScrollY.current) {
                setScrollDirection('down');
            } else if (currentScrollY < lastScrollY.current) {
                setScrollDirection('up');
            }

            lastScrollY.current = currentScrollY;
            setIsVisible(currentScrollY > 50); // General visibility threshold
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Init

        return () => window.removeEventListener('scroll', handleScroll);
    }, [isFocusedFlow]);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (isFocusedFlow) {
        return null;
    }

    const isTopState = scrollDirection === 'down' || scrollDirection === 'top';

    return (
        <div className={`${styles.ctaContainer} ${isVisible ? styles.visible : ''}`} aria-hidden={!isVisible}>
            <div className={`${styles.morphContainer} ${isTopState ? styles.isTop : styles.isBook}`}>
                <Link href="/booking" className={styles.bookContent} tabIndex={isTopState ? -1 : 0}>
                    BOOK A CALL
                </Link>

                <button
                    className={styles.topContent}
                    onClick={scrollToTop}
                    aria-label="Back to top"
                    tabIndex={isTopState ? 0 : -1}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
