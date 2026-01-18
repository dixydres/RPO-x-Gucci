import Button from "./components/Button";

function App() {
  return (
    <>
      <div className="flex flex-col gap-4 bg-gray-900 text-white p-8">
        <h1 className="text-4xl font-bold">RPO X Gucci</h1>
        <p className="text-lg">Ready Player One x Gucci Experience</p>
        <div className="flex gap-4">
          <Button className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded">Button</Button>
          <Button className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded">Submit</Button>
        </div>
      </div>
    </>
  );
}

export default App;
