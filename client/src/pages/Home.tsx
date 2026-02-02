import Hero from "../components/Hero";
import Features from "../components/Features";
import Pricing from "../components/Pricing";
import Faq from "../components/Faq";
import CTA from "../components/CTA";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function Home() {
    const { hash } = useLocation();

    useEffect(() => {
        if (!hash) return;

        // route değişiminden sonra DOM hazır olsun diye micro-delay iyi oluyor
        const id = hash; // "#pricing" gibi geliyor
        setTimeout(() => {
            const el = document.querySelector(id);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 0);
    }, [hash]);
    return (
        <>
            <Hero />
            <Features />
            <Pricing />
            <Faq />
            <CTA />
        </>
    )
}