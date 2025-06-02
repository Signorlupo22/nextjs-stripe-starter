'use client';

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import React from "react";

interface LoadingAnimationProps {
    className?: string;
    size?: 'small' | 'medium' | 'large' | 'xl' | 'xxl';
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
    className,
    size = 'large'
}) => {
    const sizeClasses = {
        small: 'w-4 h-4 border-2',
        medium: 'w-6 h-6 border-2',
        large: 'w-8 h-8 border-2',
        xl: 'w-12 h-12 border-2',
        xxl: 'w-20 h-20 border-2'
    };


    const theme = useTheme();
    const shadowColor = theme.resolvedTheme === "dark" ? "white" : "black";

    return (
        <div className="flex flex-col items-center justify-center space-y-4">
            <div
                className={cn(
                    "rounded-full border border-t-foreground",
                    "animate-[spin_1s_ease-in-out_infinite]",
                    sizeClasses[size],
                    className
                )}
                role="status"
                aria-label="Loading"
            >
            </div>
            <h1 className="font-extrabold tracking-tighter text-4xl">Loading...</h1>
        </div>
    );
};

export default LoadingAnimation;