import { Crown } from "lucide-react";

export default function Logo({ size = 16 }: { size?: number }) {
    return (
        <div className="flex items-center justify-center w-full h-full">
            <div className="flex items-center gap-2 bg-primary p-3 rounded-2xl">
                <Crown size={size} />
            </div>
        </div>
    )
}