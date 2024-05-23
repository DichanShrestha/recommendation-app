import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/user.model";
import { sendVerificationEmail } from "@/helpers/sendVerificationEmail";
import bcryptjs from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  await dbConnect();

  try {
    const {username, email, password} = await request.json();

    const existingVerifiedUserByUsername = await UserModel.findOne({
      username,
      isVerified: true
    })

    if (existingVerifiedUserByUsername) {
      return NextResponse.json(
        {
          success: false,
          message: "Username is already taken"
        }
      )
    }

    const existingUserByEmail = await UserModel.findOne({email})
    let verifyCode = Math.floor(100000 + Math.random() * 900000).toString()

    if (existingUserByEmail) {
      if (existingUserByEmail.isVerified) {
        return NextResponse.json(
          {
            success: false,
            message: 'User already exists with this email',
          },
          { status: 400 }
        );
      } else {

        existingUserByEmail.password = await bcryptjs.hash(password, 10)
        existingUserByEmail.verifyCode = verifyCode
        existingUserByEmail.verifyCodeExpiry = new Date(Date.now() + 3600000);
        await existingUserByEmail.save();
      }

    } else {
      const hashedPassword = await bcryptjs.hash(password, 10);
      const expiryDate = new Date()
      expiryDate.setHours(expiryDate.getHours() + 1);

      const newUser = new UserModel({
        username,
        email,
        password: hashedPassword,
        verifyCode,
        verifyCodeExpiry: expiryDate,
        isVerified: false,
        isAcceptingMessage: true,
        messages: []
      })

      await newUser.save()
    }

    const emailResponse = await sendVerificationEmail(
      email,
      username,
      verifyCode
    )

    if (!emailResponse.success) {
      return NextResponse.json(
        {
          success: false,
          message: emailResponse.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'User registered successfully. Please verify your account.',
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error registering user: ", error);
    return NextResponse.json(
      {
        success: true,
        message: "Error registering user",
      },
      {
        status: 500,
      }
    );
  }
}
