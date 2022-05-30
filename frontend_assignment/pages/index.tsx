import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers } from "ethers"
import { useForm, SubmitHandler } from "react-hook-form" 
import * as yup from "yup";
import { yupResolver } from '@hookform/resolvers/yup';
import Head from "next/head"
import React, { useCallback } from "react"
import styles from "../styles/Home.module.css"

type Inputs = {
    Name: string,
    Age: string,
    Address: string,
  };

// const useYupValidationResolver = (validationSchema: { validate: (arg0: any, arg1: { abortEarly: boolean }) => any }) =>
//   useCallback(
//     async (data: any) => {
//       try {
//         const values = await validationSchema.validate(data, {
//           abortEarly: false
//         });

//         return {
//           values,
//           errors: {}
//         };
//       } catch (errors) {
//         return {
//           values: {},
//           errors: {}
//         };
//       }
//     },
//     [validationSchema]
//   );
  
const validationSchema = yup.object({
  Name: yup.string().required("Input name"),
  age: yup.string().required("Input age"),
  address: yup.string().required("Input address"),
});

export default function Home() {
    // const resolver = useYupValidationResolver(validationSchema);
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const { register, handleSubmit, watch, formState: { errors } } = useForm({resolver: yupResolver(validationSchema)});
    // const onSubmit: SubmitHandler<Inputs> = (data: any) => console.log(data);

    const name = watch('Name')
    const age = watch('Age')
    const address = watch('Address')
    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()
        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = name + " " + age + " " + address
        console.log(greeting)
        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :) and message is " + greeting)
        }
    }

    // console.log(errors)
    
    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>
                
                <form onSubmit={handleSubmit((data: any) => {
                    console.log(data)
                })}>
                    <input {...register("Name", {
                        required: "Your name is required"
                        })} 
                        placeholder="Enter Your Name"
                        />
                    <p>Your input name is: {name}</p>
                    <input {...register("Age", {
                        required: "Your age is required",
                        maxLength : {
                        value: 3,
                        message: "Your age must be less than 3 digits"
                    }})} 
                    placeholder="Enter Your Age"
                    />
                    <p>Your input age is: {age}</p>
                    <input {...register("Address")} placeholder="Enter Your Address"/>
                    <p>Your input address is: {address}</p>
                    <input type="submit"/>
                </form>
                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
            </main>
        </div>
    )
}
