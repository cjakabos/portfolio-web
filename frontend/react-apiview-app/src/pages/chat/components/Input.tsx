import React, { useState } from 'react'
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

const Input = ({ onSendMessage }) => {
    const [text, setText] = useState("")

    let onChange = (e) => {
        setText(e.target.value)
    }

    let onSubmit = () => {
        setText("")
        onSendMessage(text);
    }

    return (
        <div className="message-input text-black dark:text-white">
            <TextField
                className="inputField text-black dark:text-white"
                label="Type your message here..."
                placeholder="Enter your message and press ENTER"
                onChange={e => onChange(e)}
                margin="normal"
                value={text}
                onKeyPress={event => {
                    if (event.key === 'Enter') {
                        onSubmit();
                    }
                }}
                inputProps={{ style: { color: 'blue' } }}
                InputLabelProps={{ style: { color: 'black' } }}
                style={{ height: "40px", width: "600px", marginRight: '10px'}}
            />

            <Button
                onClick={onSubmit}
                style={{ width: "30px", marginTop: '15px', padding: '10px', color: 'white', backgroundColor:'green' }}>
                Send
            </Button>
        </div>
    );
}


export default Input
