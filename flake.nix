{
  description = "agentmemory development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      packageForSystem =
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        in
        pkgs.buildNpmPackage {
          pname = "agentmemory";
          version = packageJson.version;
          src = pkgs.lib.cleanSource ./.;
          nodejs = pkgs.nodejs_26;

          npmDeps = pkgs.fetchNpmDeps {
            name = "agentmemory-npm-deps";
            src = pkgs.lib.cleanSource ./.;
            nativeBuildInputs = [ pkgs.nodejs_26 ];
            postPatch = ''
              npm install --package-lock-only --legacy-peer-deps --ignore-scripts --no-audit --no-fund
            '';
            hash = "sha256-BIPusiFBm2ibNZbPE+dQj1oDauvY2zsI69YzO2YzoC8=";
          };

          npmFlags = [
            "--legacy-peer-deps"
            "--no-audit"
            "--no-fund"
          ];
          npmInstallFlags = [ "--legacy-peer-deps" ];
          makeWrapperArgs = [
            "--prefix"
            "PATH"
            ":"
            (pkgs.lib.makeBinPath [
              pkgs.curl
              pkgs.gnutar
            ])
          ];

          meta = {
            description = packageJson.description;
            homepage = "https://github.com/rohitg00/agentmemory";
            license = pkgs.lib.licenses.asl20;
            mainProgram = "agentmemory";
          };
        };
    in
    {
      packages = forAllSystems (system: {
        default = packageForSystem system;
        agentmemory = packageForSystem system;
      });

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_26
              curl
              gnutar
            ];
          };
        }
      );

      formatter = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        pkgs.nixfmt
      );
    };
}
