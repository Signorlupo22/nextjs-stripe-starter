"use server"
import { User } from "@/lib/supabase/type";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import sharp from "sharp";


export const GetCurrentUser = async (): Promise<User | null> => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: userData = null } = await supabase
        .from("User")
        .select("*")
        .eq("id", user?.id)
        .single<User>();

    return userData;
}


export const GetCurrentUserId = async (): Promise<string | null> => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return user?.id || null;
}

export const GetCurrentUserEmail = async (): Promise<string | null> => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return user?.email || null;
}


export const GetUserByName = async (username: string): Promise<User | null> => {
    const supabase = await createClient();
    const { data: userData = null } = await supabase
        .from("User")
        .select("*")
        .eq("display_name", username)
        .single<User>();

    return userData;
}


export interface EditProfileResponse {
    message?: string;
    error?: string;
}

export const editProfile = async (
    prevState: any,
    formData: FormData
): Promise<EditProfileResponse> => {
    "use server";

    const supabase = await createClient();
    const username = formData.get("display_name") as string;
    const email = formData.get("email") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const description = formData.get("description") as string;
    const social = formData.get("social") ? JSON.parse(formData.get("social") as string) : null;
    let coverImage = formData.get("avatar") as File | null;

    console.log(formData)

    if (coverImage && coverImage.type === "application/octet-stream") {
        coverImage = new File([coverImage], coverImage.name, { type: "image/jpeg" });
    }

    const user = await GetCurrentUser();
    if (!user) {
        return { error: "User not found or authentication error" };
    }

    const modifications: Record<string, string> = {};

    if (username) modifications["display_name"] = username;
    if (email) modifications["email"] = email;
    if (firstName) modifications["first_name"] = firstName;
    if (lastName) modifications["last_name"] = lastName;
    if (description) modifications["description"] = description;
    if(social) modifications["social"] = social;

    let coverUrl = user.avatar_url ?? "";
    const fileName = `public/avatar/${user.id}.jpg`;

    if (coverImage) {
        const imageBuffer = await coverImage.arrayBuffer();
        if (imageBuffer.byteLength > 0) {
            const compressedImage = await sharp(Buffer.from(imageBuffer))
                .resize(800)
                .jpeg({ quality: 80 })
                .toBuffer();

            const compressedBlob = new Blob([compressedImage], { type: "image/jpeg" });

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("profilePic")
                .upload(fileName, compressedBlob, {
                    cacheControl: "3600",
                    upsert: true,
                });

            if (uploadError) {
                console.error("Error uploading image", uploadError);
                return { error: "Could not upload cover image" };
            }

            coverUrl = supabase.storage.from("profilePic").getPublicUrl(fileName).data.publicUrl;
        }
    }

    modifications["avatar_url"] = coverUrl;

    console.log(modifications)

    const { data, error } = await supabase
        .from("User")
        .update(modifications)
        .eq("id", user.id)
        .select("id");

    if (!data) {
        console.error(error);
        return { error: `Error editing user: ${error?.message ?? "Unknown error"}` };
    }

    revalidatePath("/settings")

    return { message: "Profile info changed successfully" };
};